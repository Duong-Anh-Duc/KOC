"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeScrapeResultService = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
class YouTubeScrapeResultService {
    /**
     * Save scrape result for a KOC
     */
    static async saveResult(kocId, channelId, data) {
        try {
            const result = await database_1.default.youTubeScrapeResult.create({
                data: {
                    koc_id: kocId,
                    channel_id: channelId,
                    views: data.totals.views != null ? BigInt(data.totals.views) : null,
                    watch_time_hours: data.totals.watchTimeHours,
                    estimated_revenue: data.totals.estimatedRevenue,
                    avg_watch_time: data.totals.avgWatchTime || null,
                    period: data.period || null,
                    country_data: data.countries,
                    ...(data.rawText ? { raw_texts: { revenue_explore: data.rawText } } : {}),
                    scraped_at: new Date(data.scrapedAt),
                },
            });
            logger_middleware_1.default.info(`💾 Saved scrape result for KOC ${kocId} (channel: ${channelId})`);
            return result;
        }
        catch (error) {
            logger_middleware_1.default.error(`❌ Failed to save scrape result for KOC ${kocId}:`, error.message);
            throw error;
        }
    }
    /**
     * Save multiple scrape results (batch from scrape-all)
     */
    static async saveBatchResults(results) {
        const saved = [];
        const errors = [];
        for (const item of results) {
            try {
                const result = await this.saveResult(item.kocId, item.channelId, item.analytics);
                saved.push(result);
            }
            catch (error) {
                errors.push({ kocId: item.kocId, error: error.message });
            }
        }
        logger_middleware_1.default.info(`💾 Batch save: ${saved.length} saved, ${errors.length} errors`);
        return { saved, errors };
    }
    /**
     * Get latest scrape result for each active KOC
     */
    static async getLatestForAllKOCs() {
        const results = await database_1.default.$queryRaw `
      SELECT DISTINCT ON (sr.koc_id)
        sr.id,
        sr.koc_id,
        sr.channel_id,
        sr.views,
        sr.watch_time_hours,
        sr.estimated_revenue,
        sr.avg_watch_time,
        sr.period,
        sr.country_data,
        sr.raw_texts,
        sr.scraped_at,
        k.full_name,
        k.channel_name,
        k.youtube_channel_id,
        k.status AS koc_status
      FROM youtube_scrape_results sr
      JOIN kocs k ON k.id = sr.koc_id
      WHERE k.status = 'ACTIVE'
      ORDER BY sr.koc_id, sr.scraped_at DESC
    `;
        return results.map((r) => ({
            id: r.id,
            koc_id: r.koc_id,
            channel_id: r.channel_id,
            views: r.views != null ? Number(r.views) : null,
            watch_time_hours: r.watch_time_hours != null ? Number(r.watch_time_hours) : null,
            estimated_revenue: r.estimated_revenue != null ? Number(r.estimated_revenue) : null,
            avg_watch_time: r.avg_watch_time,
            period: r.period,
            country_data: r.country_data,
            raw_texts: r.raw_texts,
            scraped_at: r.scraped_at.toISOString(),
            full_name: r.full_name,
            channel_name: r.channel_name,
            youtube_channel_id: r.youtube_channel_id,
            koc_status: r.koc_status,
        }));
    }
    /**
     * Get scrape history for a specific KOC
     */
    static async getHistoryByKOC(kocId, limit = 20) {
        const results = await database_1.default.youTubeScrapeResult.findMany({
            where: { koc_id: kocId },
            orderBy: { scraped_at: 'desc' },
            take: limit,
            include: {
                koc: {
                    select: { full_name: true, channel_name: true },
                },
            },
        });
        return results.map((r) => ({
            ...r,
            views: r.views != null ? Number(r.views) : null,
            watch_time_hours: r.watch_time_hours != null ? Number(r.watch_time_hours) : null,
            estimated_revenue: r.estimated_revenue != null ? Number(r.estimated_revenue) : null,
        }));
    }
    /**
     * Get latest single scrape for a KOC
     */
    static async getLatestByKOC(kocId) {
        const result = await database_1.default.youTubeScrapeResult.findFirst({
            where: { koc_id: kocId },
            orderBy: { scraped_at: 'desc' },
            include: {
                koc: {
                    select: { full_name: true, channel_name: true },
                },
            },
        });
        if (!result)
            return null;
        return {
            ...result,
            views: result.views != null ? Number(result.views) : null,
            watch_time_hours: result.watch_time_hours != null ? Number(result.watch_time_hours) : null,
            estimated_revenue: result.estimated_revenue != null ? Number(result.estimated_revenue) : null,
        };
    }
}
exports.YouTubeScrapeResultService = YouTubeScrapeResultService;
//# sourceMappingURL=youtube-scrape-result.service.js.map