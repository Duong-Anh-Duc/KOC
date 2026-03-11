import { YouTubeAnalyticsData } from './youtube-scraper.service';
interface ScrapeJob {
    id: string;
    channelIds: string[];
    channelToKocMap?: Map<string, string>;
    adminId?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt: Date;
    completedAt?: Date;
    results: YouTubeAnalyticsData[];
    errors: Array<{
        channelId: string;
        error: string;
    }>;
}
export declare class YouTubeScraperSchedulerService {
    /**
     * Start async scrape job (returns immediately)
     * Job runs in background
     */
    static startAsyncScrapeJob(channelIds: string[], channelToKocMap?: Map<string, string>, adminId?: string): Promise<{
        jobId: string;
        message: string;
    }>;
    /**
     * Get job status
     */
    static getJobStatus(jobId: string): ScrapeJob | null;
    /**
     * Execute scrape job in background
     */
    private static executeJob;
    /**
     * Clean up old jobs (older than 1 hour)
     */
    static cleanupOldJobs(): void;
}
export {};
//# sourceMappingURL=youtube-scraper-scheduler.service.d.ts.map