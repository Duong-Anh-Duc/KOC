import { Page } from 'playwright';

// Re-export Page type so socialblade.service.ts can import from here if needed
export type { Page } from 'playwright';

/** Revenue by country row */
export interface RevenueByCountry {
  country: string;
  estimatedRevenue: number | null;
  revenuePercent: number | null;
  views: number | null;
  viewsPercent: number | null;
  watchTimeHours: number | null;
  watchTimePercent: number | null;
  avgWatchTime: string | null;
}

export interface YouTubeAnalyticsData {
  channelId: string;
  /** Total row from the explore table */
  totals: {
    estimatedRevenue: number | null;
    views: number | null;
    watchTimeHours: number | null;
    avgWatchTime: string | null;
  };
  /** Revenue breakdown by country */
  countries: RevenueByCountry[];
  /** Period label (e.g. "Thang 1") */
  period: string;
  /** Raw page text for debugging */
  rawText?: string;
  scrapedAt: string;
}

/**
 * Safely close a Playwright page, ignoring errors if target is already gone
 */
export async function safeClosePage(page: Page | null): Promise<void> {
  if (!page) return;
  try {
    await page.close();
  } catch (err: any) {
    const logger = (await import('../../../middlewares/logger.middleware')).default;
    if (!err.message?.includes('Target closed') && !err.message?.includes('has been closed')) {
      logger.warn('Error closing page (ignored):', err.message);
    }
  }
}
