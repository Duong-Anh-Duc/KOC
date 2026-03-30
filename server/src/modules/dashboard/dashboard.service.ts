import prisma from '../../config/database';
import { RevenueService } from '../revenue/revenue.service';

export class DashboardService {
  /**
   * Get dashboard overview data (includes workflow info + growth summary)
   * If adminId is provided, scope all data to that admin's KOCs
   * If allowedKocIds is provided, scope to those specific KOCs (for ACCOUNTANT)
   */
  static async getOverview(adminId?: string, allowedKocIds?: string[]) {
    const kocFilter = adminId
      ? { admin_id: adminId }
      : allowedKocIds
        ? { id: { in: allowedKocIds } }
        : {};
    const kocActiveFilter = { status: 'ACTIVE' as const, ...kocFilter };

    // Get KOC IDs for filtering revenue records
    const scopedKocIds = adminId
      ? (await prisma.kOC.findMany({ where: { admin_id: adminId }, select: { id: true } })).map(k => k.id)
      : allowedKocIds || null;
    const recordFilter = scopedKocIds ? { koc_id: { in: scopedKocIds } } : {};

    // If scoped, find only cycles that contain their KOCs' records
    let scopedCycleIds: number[] | null = null;
    if (scopedKocIds && scopedKocIds.length > 0) {
      const scopedRecordCycles = await prisma.revenueRecord.findMany({
        where: { koc_id: { in: scopedKocIds } },
        select: { cycle_id: true },
        distinct: ['cycle_id'],
      });
      scopedCycleIds = scopedRecordCycles.map(r => r.cycle_id);
    }
    const cycleFilter = scopedCycleIds ? { id: { in: scopedCycleIds } } : {};

    const [
      totalKOCs,
      activeKOCs,
      totalCycles,
      latestCycle,
      recentRecords,
      cyclesByStatus,
      totalRevenueRecords,
      pubCodeMatched,
      pubCodeMismatched,
    ] = await Promise.all([
      prisma.kOC.count({ where: kocFilter }),
      prisma.kOC.count({ where: kocActiveFilter }),
      prisma.revenueCycle.count({ where: cycleFilter }),
      prisma.revenueCycle.findFirst({
        where: cycleFilter,
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { revenue_records: scopedKocIds ? { where: { koc_id: { in: scopedKocIds } } } : true } } },
      }),
      prisma.revenueRecord.findMany({
        where: recordFilter,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          koc: { select: { full_name: true, channel_name: true } },
          cycle: { select: { month: true } },
        },
      }),
      prisma.revenueCycle.groupBy({
        by: ['status'],
        _count: true,
        ...(scopedCycleIds ? { where: { id: { in: scopedCycleIds } } } : {} as any),
      }),
      prisma.revenueRecord.count({ where: recordFilter }),
      prisma.revenueRecord.count({
        where: { ...recordFilter, pub_code_match: true },
      }),
      prisma.revenueRecord.count({
        where: { ...recordFilter, pub_code_match: false },
      }),
    ]);

    // Revenue summary for latest cycle
    let cycleSummary = null;
    if (latestCycle) {
      const allRecords = await RevenueService.getRecordsByCycle(latestCycle.id, undefined, adminId, allowedKocIds);
      cycleSummary = {
        cycle: latestCycle,
        totalOriginal: allRecords.totals.totalOriginal,
        totalNetRevenue: allRecords.totals.totalNetRevenue,
        totalCompanyShare: allRecords.totals.totalCompanyShare,
        totalKocReceiveUsd: allRecords.totals.totalKocReceiveUsd,
        totalKocReceiveVnd: allRecords.totals.totalKocReceiveVnd,
      };
    }

    // Growth summary from YT Analytics (top 5 by views in last 28 days)
    let growthSummary: Array<{
      koc_id: string;
      full_name: string;
      channel_name: string;
      views_growth: number;
      subs_growth: number;
      views_diff: number;
      subs_diff: number;
    }> = [];
    try {
      const activeKocList = await prisma.kOC.findMany({
        where: kocActiveFilter,
        include: {
          channel_stats: {
            orderBy: { recorded_at: 'desc' },
            take: 2,
          },
        },
      });

      growthSummary = activeKocList
        .map((koc) => {
          if (koc.channel_stats.length < 1) {
            return null;
          }

          const latest = koc.channel_stats[0];
          const latestYt = latest.yt_analytics as any;

          if (!latestYt?.byCountry?.totals) {
            return null;
          }

          const latestViews = latestYt.byCountry.totals.views || 0;
          const latestSubs = latestYt.byCountry.totals.subscribersNet || 0;

          let viewsGrowth = 0;
          let subsGrowth = 0;

          if (koc.channel_stats.length >= 2) {
            const prev = koc.channel_stats[1];
            const prevYt = prev.yt_analytics as any;

            if (prevYt?.byCountry?.totals) {
              const prevViews = prevYt.byCountry.totals.views || 0;
              const prevSubs = prevYt.byCountry.totals.subscribersNet || 0;

              if (prevViews > 0) {
                viewsGrowth = ((latestViews - prevViews) / prevViews) * 100;
              }
              if (prevSubs !== 0) {
                subsGrowth = prevSubs !== 0 ? ((latestSubs - prevSubs) / Math.abs(prevSubs)) * 100 : 0;
              }
            }
          }

          return {
            koc_id: koc.id,
            full_name: koc.full_name,
            channel_name: koc.channel_name,
            views_growth: Math.round(viewsGrowth * 100) / 100,
            subs_growth: Math.round(subsGrowth * 100) / 100,
            views_diff: latestViews,
            subs_diff: latestSubs,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => Math.abs(b.views_diff) - Math.abs(a.views_diff))
        .slice(0, 5);
    } catch {
      // Growth data is optional
    }

    return {
      totalKOCs,
      activeKOCs,
      totalCycles,
      latestCycleSummary: cycleSummary,
      recentRecords,
      growthSummary,
      cyclesByStatus: cyclesByStatus.reduce((acc, item: any) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      pubCodeStats: {
        total: totalRevenueRecords,
        matched: pubCodeMatched,
        mismatched: pubCodeMismatched,
        notChecked: totalRevenueRecords - pubCodeMatched - pubCodeMismatched,
      },
      latestExchangeRate: latestCycle?.exchange_rate ? Number(latestCycle.exchange_rate) : null,
    };
  }

  /**
   * Get revenue trend data (last N cycles)
   */
  static async getRevenueTrend(limit: number = 12, adminId?: string, allowedKocIds?: string[]) {
    // Get KOC IDs for filtering
    const scopedKocIds = adminId
      ? (await prisma.kOC.findMany({ where: { admin_id: adminId }, select: { id: true } })).map(k => k.id)
      : allowedKocIds || null;

    // Only show cycles that contain scoped records
    let cycleFilter: any = {};
    if (scopedKocIds && scopedKocIds.length > 0) {
      const scopedRecordCycles = await prisma.revenueRecord.findMany({
        where: { koc_id: { in: scopedKocIds } },
        select: { cycle_id: true },
        distinct: ['cycle_id'],
      });
      cycleFilter = { id: { in: scopedRecordCycles.map(r => r.cycle_id) } };
    }

    const cycles = await prisma.revenueCycle.findMany({
      where: cycleFilter,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        revenue_records: {
          where: scopedKocIds ? { koc_id: { in: scopedKocIds } } : undefined,
          select: {
            status: true,
            original_revenue_usd: true,
            koc_receive_usd: true,
            company_share: true,
          },
        },
      },
    });

    const mapped = cycles.reverse().map((cycle) => {
      const totalRevenue = cycle.revenue_records.reduce(
        (sum, r) => sum + Number(r.original_revenue_usd),
        0
      );
      const totalKocPay = cycle.revenue_records.reduce(
        (sum, r) => sum + Number(r.koc_receive_usd),
        0
      );
      const totalCompanyShare = cycle.revenue_records.reduce(
        (sum, r) => sum + Number(r.company_share),
        0
      );

      return {
        month: cycle.month,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalKocPay: Math.round(totalKocPay * 100) / 100,
        totalCompanyShare: Math.round(totalCompanyShare * 100) / 100,
        recordCount: cycle.revenue_records.length,
        revenueGrowth: 0,
      };
    });

    for (let i = 0; i < mapped.length; i++) {
      if (i > 0 && mapped[i - 1].totalRevenue > 0) {
        const prev = mapped[i - 1].totalRevenue;
        const curr = mapped[i].totalRevenue;
        mapped[i].revenueGrowth = Math.round(((curr - prev) / prev) * 100 * 100) / 100;
      }
    }

    return mapped;
  }
}
