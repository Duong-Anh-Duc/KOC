"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KocPortalController = void 0;
const database_1 = __importDefault(require("../config/database"));
const middlewares_1 = require("../middlewares");
class KocPortalController {
    /**
     * GET /api/koc-portal/my-revenue
     * Returns all revenue records for the logged-in KOC user, grouped by cycle
     */
    static async getMyRevenue(req, res, next) {
        try {
            const t = req.t;
            const kocId = req.user?.kocId;
            if (!kocId) {
                throw new middlewares_1.ApiError(403, 'auth.noKocLinked');
            }
            // Get the KOC info
            const koc = await database_1.default.kOC.findUnique({
                where: { id: kocId },
                select: {
                    id: true,
                    full_name: true,
                    channel_name: true,
                    youtube_channel_id: true,
                    email: true,
                    base_rate: true,
                    pub_code: true,
                    status: true,
                },
            });
            if (!koc) {
                throw new middlewares_1.ApiError(404, 'koc.notFound');
            }
            // Get all revenue records for this KOC
            const records = await database_1.default.revenueRecord.findMany({
                where: { koc_id: kocId },
                include: {
                    cycle: {
                        select: {
                            id: true,
                            month: true,
                            status: true,
                            exchange_rate: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
            });
            res.status(200).json({
                success: true,
                message: t ? t('kocPortal.revenueRetrieved') : 'Revenue records retrieved',
                data: {
                    koc,
                    records,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/koc-portal/my-stats
     * Returns latest channel stats for the logged-in KOC
     */
    static async getMyStats(req, res, next) {
        try {
            const t = req.t;
            const kocId = req.user?.kocId;
            if (!kocId) {
                throw new middlewares_1.ApiError(403, 'auth.noKocLinked');
            }
            // Get latest scrape result
            const latestScrape = await database_1.default.youTubeScrapeResult.findFirst({
                where: { koc_id: kocId },
                orderBy: { scraped_at: 'desc' },
            });
            // Get monthly revenue analytics
            const monthlyAnalytics = await database_1.default.monthlyRevenueAnalytics.findMany({
                where: { koc_id: kocId },
                orderBy: { month_key: 'desc' },
                take: 12,
            });
            // Convert BigInt to string for JSON serialization
            const serializedScrape = latestScrape ? {
                ...latestScrape,
                views: latestScrape.views?.toString(),
            } : null;
            const serializedAnalytics = monthlyAnalytics.map(item => ({
                ...item,
                views: item.views?.toString(),
            }));
            res.status(200).json({
                success: true,
                message: t ? t('kocPortal.statsRetrieved') : 'Stats retrieved',
                data: {
                    latestScrape: serializedScrape,
                    monthlyAnalytics: serializedAnalytics,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.KocPortalController = KocPortalController;
//# sourceMappingURL=koc-portal.controller.js.map