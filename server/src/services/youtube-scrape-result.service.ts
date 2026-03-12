import prisma from '../config/database';
import logger from '../middlewares/logger.middleware';
import { YouTubeAnalyticsData } from './youtube-scraper.service';

export class YouTubeScrapeResultService {
  /**
   * Save scrape result for a KOC
   */
  static async saveResult(kocId: string, channelId: string, data: YouTubeAnalyticsData) {
    try {
      const result = await prisma.youTubeScrapeResult.create({
        data: {
          koc_id: kocId,
          channel_id: channelId,
          views: data.totals.views != null ? BigInt(data.totals.views) : null,
          watch_time_hours: data.totals.watchTimeHours,
          estimated_revenue: data.totals.estimatedRevenue,
          avg_watch_time: data.totals.avgWatchTime || null,
          period: data.period || null,
          country_data: data.countries as any,
          ...(data.rawText ? { raw_texts: { revenue_explore: data.rawText } } : {}),
          scraped_at: new Date(data.scrapedAt),
        },
      });

      logger.info(`Saved scrape result for KOC ${kocId} (channel: ${channelId})`);
      return result;
    } catch (error: any) {
      logger.error(`Failed to save scrape result for KOC ${kocId}:`, error.message);
      throw error;
    }
  }

  /**
   * Save multiple scrape results (batch from scrape-all)
   */
  static async saveBatchResults(
    results: Array<{
      kocId: string;
      channelId: string;
      analytics: YouTubeAnalyticsData;
    }>
  ) {
    const saved: any[] = [];
    const errors: Array<{ kocId: string; error: string }> = [];

    for (const item of results) {
      try {
        const result = await this.saveResult(item.kocId, item.channelId, item.analytics);
        saved.push(result);
      } catch (error: any) {
        errors.push({ kocId: item.kocId, error: error.message });
      }
    }

    logger.info(`Batch save: ${saved.length} saved, ${errors.length} errors`);
    return { saved, errors };
  }

  /**
   * Get latest scrape result for each active KOC
   */
  static async getLatestForAllKOCs() {
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        koc_id: string;
        channel_id: string;
        views: bigint | null;
        watch_time_hours: any;
        estimated_revenue: any;
        avg_watch_time: string | null;
        period: string | null;
        country_data: any;
        raw_texts: any;
        scraped_at: Date;
        full_name: string;
        channel_name: string;
        youtube_channel_id: string;
        koc_status: string;
      }>
    >`
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
  static async getHistoryByKOC(kocId: string, limit = 20) {
    const results = await prisma.youTubeScrapeResult.findMany({
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
  static async getLatestByKOC(kocId: string) {
    const result = await prisma.youTubeScrapeResult.findFirst({
      where: { koc_id: kocId },
      orderBy: { scraped_at: 'desc' },
      include: {
        koc: {
          select: { full_name: true, channel_name: true },
        },
      },
    });

    if (!result) return null;

    return {
      ...result,
      views: result.views != null ? Number(result.views) : null,
      watch_time_hours: result.watch_time_hours != null ? Number(result.watch_time_hours) : null,
      estimated_revenue: result.estimated_revenue != null ? Number(result.estimated_revenue) : null,
    };
  }
}
