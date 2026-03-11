"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const database_1 = __importDefault(require("../config/database"));
const revenue_service_1 = require("./revenue.service");
class DashboardService {
    /**
     * Get dashboard overview data (includes workflow info + growth summary)
     * If adminId is provided, scope all data to that admin's KOCs
     */
    static async getOverview(adminId) {
        const kocFilter = adminId ? { admin_id: adminId } : {};
        const kocActiveFilter = { status: 'ACTIVE', ...kocFilter };
        // Get admin's KOC IDs for filtering revenue records
        const adminKocIds = adminId
            ? (await database_1.default.kOC.findMany({ where: kocFilter, select: { id: true } })).map(k => k.id)
            : null;
        const recordFilter = adminKocIds ? { koc_id: { in: adminKocIds } } : {};
        // If admin, find only cycles that contain their KOCs' records
        let adminCycleIds = null;
        if (adminKocIds && adminKocIds.length > 0) {
            const adminRecordCycles = await database_1.default.revenueRecord.findMany({
                where: { koc_id: { in: adminKocIds } },
                select: { cycle_id: true },
                distinct: ['cycle_id'],
            });
            adminCycleIds = adminRecordCycles.map(r => r.cycle_id);
        }
        const cycleFilter = adminCycleIds ? { id: { in: adminCycleIds } } : {};
        const [totalKOCs, activeKOCs, totalCycles, latestCycle, recentRecords, cyclesByStatus, totalRevenueRecords, pubCodeMatched, pubCodeMismatched,] = await Promise.all([
            database_1.default.kOC.count({ where: kocFilter }),
            database_1.default.kOC.count({ where: kocActiveFilter }),
            database_1.default.revenueCycle.count({ where: cycleFilter }),
            database_1.default.revenueCycle.findFirst({
                where: cycleFilter,
                orderBy: { created_at: 'desc' },
                include: { _count: { select: { revenue_records: adminKocIds ? { where: { koc_id: { in: adminKocIds } } } : true } } },
            }),
            database_1.default.revenueRecord.findMany({
                where: recordFilter,
                take: 5,
                orderBy: { created_at: 'desc' },
                include: {
                    koc: { select: { full_name: true, channel_name: true } },
                    cycle: { select: { month: true } },
                },
            }),
            database_1.default.revenueCycle.groupBy({
                by: ['status'],
                _count: true,
                ...(adminCycleIds ? { where: { id: { in: adminCycleIds } } } : {}),
            }),
            database_1.default.revenueRecord.count({ where: recordFilter }),
            database_1.default.revenueRecord.count({
                where: { ...recordFilter, pub_code_match: true },
            }),
            database_1.default.revenueRecord.count({
                where: { ...recordFilter, pub_code_match: false },
            }),
        ]);
        // Revenue summary for latest cycle — show totals from ALL records (not just APPROVED)
        // so admin can see full picture before approving
        let cycleSummary = null;
        if (latestCycle) {
            const allRecords = await revenue_service_1.RevenueService.getRecordsByCycle(latestCycle.id, undefined, adminId);
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
        let growthSummary = [];
        try {
            const activeKocList = await database_1.default.kOC.findMany({
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
                    return null; // Skip KOCs with no stats
                }
                const latest = koc.channel_stats[0];
                const latestYt = latest.yt_analytics;
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
                    const prevYt = prev.yt_analytics;
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
                .filter((item) => item !== null)
                .sort((a, b) => Math.abs(b.views_diff) - Math.abs(a.views_diff))
                .slice(0, 5);
        }
        catch {
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
            }, {}),
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
    static async getRevenueTrend(limit = 12, adminId) {
        // Get admin's KOC IDs for filtering
        const adminKocIds = adminId
            ? (await database_1.default.kOC.findMany({ where: { admin_id: adminId }, select: { id: true } })).map(k => k.id)
            : null;
        // Only show cycles that contain this admin's records
        let cycleFilter = {};
        if (adminKocIds && adminKocIds.length > 0) {
            const adminRecordCycles = await database_1.default.revenueRecord.findMany({
                where: { koc_id: { in: adminKocIds } },
                select: { cycle_id: true },
                distinct: ['cycle_id'],
            });
            cycleFilter = { id: { in: adminRecordCycles.map(r => r.cycle_id) } };
        }
        const cycles = await database_1.default.revenueCycle.findMany({
            where: cycleFilter,
            take: limit,
            orderBy: { created_at: 'desc' },
            include: {
                revenue_records: {
                    where: adminKocIds ? { koc_id: { in: adminKocIds } } : undefined,
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
            // Use ALL records (not just APPROVED) for dashboard totals
            const totalRevenue = cycle.revenue_records.reduce((sum, r) => sum + Number(r.original_revenue_usd), 0);
            const totalKocPay = cycle.revenue_records.reduce((sum, r) => sum + Number(r.koc_receive_usd), 0);
            const totalCompanyShare = cycle.revenue_records.reduce((sum, r) => sum + Number(r.company_share), 0);
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
exports.DashboardService = DashboardService;
//# sourceMappingURL=dashboard.service.js.map