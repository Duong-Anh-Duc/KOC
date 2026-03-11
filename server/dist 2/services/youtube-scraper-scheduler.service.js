"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeScraperSchedulerService = void 0;
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
const youtube_scrape_result_service_1 = require("./youtube-scrape-result.service");
const youtube_scraper_service_1 = require("./youtube-scraper.service");
const jobs = new Map();
class YouTubeScraperSchedulerService {
    /**
     * Start async scrape job (returns immediately)
     * Job runs in background
     */
    static async startAsyncScrapeJob(channelIds, channelToKocMap, adminId) {
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const job = {
            id: jobId,
            channelIds,
            channelToKocMap,
            adminId,
            status: 'pending',
            startedAt: new Date(),
            results: [],
            errors: [],
        };
        jobs.set(jobId, job);
        logger_middleware_1.default.info(`📝 Created scrape job ${jobId} for ${channelIds.length} channels`);
        // Start background job (don't await)
        this.executeJob(jobId);
        return {
            jobId,
            message: `Scrape job started. Job ID: ${jobId}`,
        };
    }
    /**
     * Get job status
     */
    static getJobStatus(jobId) {
        return jobs.get(jobId) || null;
    }
    /**
     * Execute scrape job in background
     */
    static async executeJob(jobId) {
        const job = jobs.get(jobId);
        if (!job)
            return;
        try {
            job.status = 'running';
            logger_middleware_1.default.info(`🚀 Running job ${jobId}`);
            const { results, errors } = await youtube_scraper_service_1.YouTubeScraperService.scrapeMultipleChannels(job.channelIds, undefined, undefined, job.adminId);
            job.results = results;
            job.errors = errors;
            job.status = 'completed';
            job.completedAt = new Date();
            // Save results to database if we have the KOC mapping
            if (job.channelToKocMap && job.channelToKocMap.size > 0) {
                const batchItems = results
                    .filter(r => job.channelToKocMap.has(r.channelId))
                    .map(r => ({
                    kocId: job.channelToKocMap.get(r.channelId),
                    channelId: r.channelId,
                    analytics: r,
                }));
                if (batchItems.length > 0) {
                    await youtube_scrape_result_service_1.YouTubeScrapeResultService.saveBatchResults(batchItems);
                    logger_middleware_1.default.info(`💾 Job ${jobId}: Saved ${batchItems.length} results to database`);
                }
            }
            logger_middleware_1.default.info(`✅ Job ${jobId} completed: ${results.length} success, ${errors.length} failed`);
        }
        catch (error) {
            job.status = 'failed';
            job.completedAt = new Date();
            job.errors = [{ channelId: 'batch', error: error.message }];
            logger_middleware_1.default.error(`❌ Job ${jobId} failed:`, error);
        }
    }
    /**
     * Clean up old jobs (older than 1 hour)
     */
    static cleanupOldJobs() {
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 hour
        for (const [jobId, job] of jobs) {
            if (now - job.startedAt.getTime() > maxAge && job.status !== 'running') {
                jobs.delete(jobId);
                logger_middleware_1.default.info(`🗑️ Cleaned up old job ${jobId}`);
            }
        }
    }
}
exports.YouTubeScraperSchedulerService = YouTubeScraperSchedulerService;
//# sourceMappingURL=youtube-scraper-scheduler.service.js.map