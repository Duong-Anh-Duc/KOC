import prisma from '../config/database';
import { RevenueService } from './revenue.service';

export class DashboardService {
  /**
   * Get dashboard overview data (includes workflow info + growth summary)
   */
  static async getOverview() {
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
      prisma.kOC.count(),
      prisma.kOC.count({ where: { status: 'ACTIVE' } }),
      prisma.revenueCycle.count(),
      prisma.revenueCycle.findFirst({
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { revenue_records: true } } },
      }),
      prisma.revenueRecord.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          koc: { select: { full_name: true, channel_name: true } },
          cycle: { select: { month: true } },
        },
      }),
      // Cycle status breakdown
      prisma.revenueCycle.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Total revenue records
      prisma.revenueRecord.count(),
      // Pub code matched
      prisma.revenueRecord.count({
        where: { pub_code_match: true },
      }),
      // Pub code mismatched
      prisma.revenueRecord.count({
        where: { pub_code_match: false },
      }),
    ]);

    // Revenue summary for latest cycle
    // totalOriginal uses ALL records; company share & KOC pay use only APPROVED
    let cycleSummary = null;
    if (latestCycle) {
      const [allRecords, approvedRecords] = await Promise.all([
        RevenueService.getRecordsByCycle(latestCycle.id),
        RevenueService.getRecordsByCycle(latestCycle.id, 'APPROVED'),
      ]);
      cycleSummary = {
        cycle: latestCycle,
        totalOriginal: allRecords.totals.totalOriginal,
        totalNetRevenue: approvedRecords.totals.totalNetRevenue,
        totalCompanyShare: approvedRecords.totals.totalCompanyShare,
        totalKocReceiveUsd: approvedRecords.totals.totalKocReceiveUsd,
        totalKocReceiveVnd: approvedRecords.totals.totalKocReceiveVnd,
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
        where: { status: 'ACTIVE' },
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
            return null; // Skip KOCs with no stats
          }

          const latest = koc.channel_stats[0];
          const latestYt = latest.yt_analytics as any;

          // If no YT Analytics data, skip this KOC
          if (!latestYt?.byCountry?.totals) {
            return null;
          }

          const latestViews = latestYt.byCountry.totals.views || 0;
          const latestSubs = latestYt.byCountry.totals.subscribersNet || 0;

          // Calculate growth if we have 2 records
          let viewsGrowth = 0;
          let subsGrowth = 0;

          if (koc.channel_stats.length >= 2) {
            const prev = koc.channel_stats[1];
            const prevYt = prev.yt_analytics as any;

            if (prevYt?.byCountry?.totals) {
              const prevViews = prevYt.byCountry.totals.views || 0;
              const prevSubs = prevYt.byCountry.totals.subscribersNet || 0;

              // Calculate % change between two 28-day periods
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
      // Growth data is optional, don't fail if YT Analytics data unavailable
    }

    return {
      totalKOCs,
      activeKOCs,
      totalCycles,
      latestCycleSummary: cycleSummary,
      recentRecords,
      growthSummary,
      cyclesByStatus: cyclesByStatus.reduce((acc, item) => {
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
  static async getRevenueTrend(limit: number = 12) {
    const cycles = await prisma.revenueCycle.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        revenue_records: {
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
      // totalRevenue uses ALL records
      const totalRevenue = cycle.revenue_records.reduce(
        (sum, r) => sum + Number(r.original_revenue_usd),
        0
      );
      // KOC pay and company share only from APPROVED records
      const approvedRecords = cycle.revenue_records.filter((r) => r.status === 'APPROVED');
      const totalKocPay = approvedRecords.reduce(
        (sum, r) => sum + Number(r.koc_receive_usd),
        0
      );
      const totalCompanyShare = approvedRecords.reduce(
        (sum, r) => sum + Number(r.company_share),
        0
      );

      return {
        month: cycle.month,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalKocPay: Math.round(totalKocPay * 100) / 100,
        totalCompanyShare: Math.round(totalCompanyShare * 100) / 100,
        recordCount: cycle.revenue_records.length,
        revenueGrowth: 0, // will be calculated below
      };
    });

    // Calculate revenue growth % vs previous month
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
