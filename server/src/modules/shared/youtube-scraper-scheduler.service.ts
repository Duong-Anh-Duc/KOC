import logger from '../../middlewares/logger.middleware';
import { YouTubeScrapeResultService } from './youtube-scrape-result.service';
import { YouTubeAnalyticsData, YouTubeScraperService } from './youtube-scraper.service';

// Store for tracking ongoing scrape jobs
interface ScrapeJob {
  id: string;
  channelIds: string[];
  channelToKocMap?: Map<string, string>;
  adminId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  results: YouTubeAnalyticsData[];
  errors: Array<{ channelId: string; error: string }>;
}

const jobs = new Map<string, ScrapeJob>();

export class YouTubeScraperSchedulerService {
  /**
   * Start async scrape job (returns immediately)
   * Job runs in background
   */
  static async startAsyncScrapeJob(
    channelIds: string[],
    channelToKocMap?: Map<string, string>,
    adminId?: string
  ): Promise<{
    jobId: string;
    message: string;
  }> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: ScrapeJob = {
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
    logger.info(`Created scrape job ${jobId} for ${channelIds.length} channels`);

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
  static getJobStatus(jobId: string): ScrapeJob | null {
    return jobs.get(jobId) || null;
  }

  /**
   * Execute scrape job in background
   */
  private static async executeJob(jobId: string): Promise<void> {
    const job = jobs.get(jobId);
    if (!job) return;

    try {
      job.status = 'running';
      logger.info(`Running job ${jobId}`);

      const { results, errors } = await YouTubeScraperService.scrapeMultipleChannelsParallel(job.channelIds, undefined, undefined, job.adminId);
      job.results = results;
      job.errors = errors;
      job.status = 'completed';
      job.completedAt = new Date();

      // Save results to database if we have the KOC mapping
      if (job.channelToKocMap && job.channelToKocMap.size > 0) {
        const batchItems = results
          .filter(r => job.channelToKocMap!.has(r.channelId))
          .map(r => ({
            kocId: job.channelToKocMap!.get(r.channelId)!,
            channelId: r.channelId,
            analytics: r,
          }));

        if (batchItems.length > 0) {
          await YouTubeScrapeResultService.saveBatchResults(batchItems);
          logger.info(`Job ${jobId}: Saved ${batchItems.length} results to database`);
        }
      }

      logger.info(`Job ${jobId} completed: ${results.length} success, ${errors.length} failed`);
    } catch (error: any) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errors = [{ channelId: 'batch', error: error.message }];
      logger.error(`Job ${jobId} failed:`, error);
    }
  }

  /**
   * Clean up old jobs (older than 1 hour)
   */
  static cleanupOldJobs(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [jobId, job] of jobs) {
      if (now - job.startedAt.getTime() > maxAge && job.status !== 'running') {
        jobs.delete(jobId);
        logger.info(`Cleaned up old job ${jobId}`);
      }
    }
  }
}
