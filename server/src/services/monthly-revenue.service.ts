import prisma from '../config/database';
import logger from '../middlewares/logger.middleware';
import type { MonthlyRevenueData, MonthlyRevenueRow } from '../types/stats.types';
import {
  parseDecimalValue,
  parseIntegerValue,
  parsePercentValue,
  parseRevenueValue,
  parseTimeValue,
} from '../utils/parseHelpers';
import { YouTubeScraperService } from './youtube-scraper.service';

// Re-export types so existing imports from this file still work
export type { MonthlyRevenueData, MonthlyRevenueRow } from '../types/stats.types';

export class MonthlyRevenueService {
  /**
   * Build URL for monthly revenue explore page
   * This uses dimension=MONTH and granularity=MONTH to get per-month breakdown  
   * Matching the URL pattern from YouTube Studio
   */
  private static buildMonthlyRevenueUrl(channelId: string): string {
    const cleanId = YouTubeScraperService.cleanChannelId(channelId);
    return `https://studio.youtube.com/channel/${cleanId}/analytics/tab-earn_revenue/period-default/explore?entity_type=CHANNEL&entity_id=${cleanId}&time_period=year&explore_type=TABLE_AND_CHART&metric=TOTAL_ESTIMATED_EARNINGS&granularity=MONTH&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=AVERAGE_WATCH_TIME&t_metrics=TOTAL_ESTIMATED_EARNINGS&dimension=MONTH&o_column=MONTH&o_direction=ANALYTICS_ORDER_DIRECTION_DESC&comparison_type=NONE`;
  }

  /**
   * Scrape monthly revenue data for a channel using the existing browser session
   */
  static async scrapeMonthlyRevenue(channelId: string, adminId?: string): Promise<MonthlyRevenueData> {
    const url = this.buildMonthlyRevenueUrl(channelId);
    const cleanId = YouTubeScraperService.cleanChannelId(channelId);
    
    logger.info(`📊 Scraping monthly revenue for channel: ${cleanId}`);

    // Use the existing scraper's shared browser session
    const browser = await YouTubeScraperService.getBrowser(false, 1, adminId); // Headful mode to match login session
    const page = await browser.newPage();

    try {
      // Apply stealth
      await page.evaluateOnNewDocument(`
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      `);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      } catch (err: any) {
        logger.warn(`⚠️ Page load timeout, continuing...`, err.message);
      }

      // Check login
      if (page.url().includes('accounts.google.com')) {
        throw new Error('NOT_LOGGED_IN');
      }

      // Wait for analytics to render
      await new Promise(r => setTimeout(r, 6000));

      // Extract text
      const text = await Promise.race([
        page.evaluate('document.body.innerText') as Promise<string>,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout extracting text')), 120000)
        ),
      ]);

      logger.info(`✓ Scraped monthly revenue page (${text.length} chars)`);

      // Parse the monthly revenue data
      const parsed = this.parseMonthlyRevenueText(text);

      return {
        channelId: cleanId,
        totals: parsed.totals,
        months: parsed.months,
        scrapedAt: new Date().toISOString(),
      };
    } finally {
      try { await page.close(); } catch { /* ignore */ }
    }
  }

  /**
   * Parse the monthly revenue explore page text.
   * Expected format (Vietnamese):
   *   Ngày ↓ | Số lượt xem ⚠ | Thời gian xem (giờ) | Thời lượng xem trung bình | Doanh thu ước tính
   *   Tổng   | 106.766.532    | 441.649,8           | 0:27                      | 1.327,87 $
   *   Tháng 2 (đang diễn ra) | 2.729.250 2,6% | 12.646,8 2,9% | 0:31 | 24,98 $ 1,9%
   *   Tháng 1 | 7.215.190 6,8% | 35.540,2 8,1% | 0:33 | 81,96 $ 6,2%
   */
  static parseMonthlyRevenueText(text: string): {
    totals: MonthlyRevenueData['totals'];
    months: MonthlyRevenueRow[];
  } {
    const totals: MonthlyRevenueData['totals'] = {
      views: null,
      watchTimeHours: null,
      avgWatchTime: null,
      estimatedRevenue: null,
    };
    const months: MonthlyRevenueRow[] = [];

    try {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      let inTable = false;
      let foundTotal = false;

      // Detect approximate current year from context
      const currentYear = new Date().getFullYear();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect table header
        if (/^(Ngày|Day)/i.test(line) || /Doanh thu ước tính|Estimated revenue/i.test(line)) {
          inTable = true;
          continue;
        }

        if (!inTable) continue;

        // Parse "Tổng" (Total) row
        if (/^Tổng$|^Total$/i.test(line) && !foundTotal) {
          foundTotal = true;
          const rowValues = this.extractRowValues(lines, i + 1, 5);
          if (rowValues.length >= 1) totals.views = parseIntegerValue(rowValues[0]);
          if (rowValues.length >= 2) totals.watchTimeHours = parseDecimalValue(rowValues[1]);
          if (rowValues.length >= 3) totals.avgWatchTime = parseTimeValue(rowValues[2]);
          if (rowValues.length >= 4) totals.estimatedRevenue = parseRevenueValue(rowValues[3]);
          continue;
        }

        // Parse month rows (after Tổng)
        if (foundTotal) {
          const monthMatch = line.match(/^(Tháng\s+\d+(?:\s*\(.*?\))?|Month\s+\d+)/i);
          if (monthMatch) {
            const monthLabel = line;
            const monthNum = this.extractMonthNumber(monthLabel);
            const monthKey = this.computeMonthKey(monthNum, currentYear, months.length);

            const rowValues = this.extractRowValues(lines, i + 1, 9);

            const row: MonthlyRevenueRow = {
              monthLabel,
              monthKey,
              views: null,
              viewsPercent: null,
              watchTimeHours: null,
              watchTimePercent: null,
              avgWatchTime: null,
              estimatedRevenue: null,
              revenuePercent: null,
            };

            // Parse values: views, views%, watchTime, watchTime%, avgWatch, revenue, revenue%
            let vidx = 0;
            for (const val of rowValues) {
              if (vidx === 0 && /^[\d.]+$/.test(val.replace(/\./g, ''))) {
                row.views = parseIntegerValue(val);
                vidx = 1;
              } else if (vidx === 1 && /%/.test(val)) {
                row.viewsPercent = parsePercentValue(val);
                vidx = 2;
              } else if (vidx <= 2 && /^[\d.,]+$/.test(val) && val.includes(',')) {
                row.watchTimeHours = parseDecimalValue(val);
                vidx = 3;
              } else if (vidx === 3 && /%/.test(val)) {
                row.watchTimePercent = parsePercentValue(val);
                vidx = 4;
              } else if (vidx <= 4 && /^\d{1,2}:\d{2}$/.test(val)) {
                row.avgWatchTime = val;
                vidx = 5;
              } else if (vidx <= 5 && /[$₫]/.test(val)) {
                row.estimatedRevenue = parseRevenueValue(val);
                vidx = 6;
              } else if (vidx === 6 && /%/.test(val)) {
                row.revenuePercent = parsePercentValue(val);
                vidx = 7;
              } else if (vidx === 1 && /^[\d.,]+$/.test(val) && val.includes(',')) {
                // No views% - jump to watch time
                row.watchTimeHours = parseDecimalValue(val);
                vidx = 3;
              }
            }

            // Handle revenue with dash (–) meaning no data
            months.push(row);
            continue;
          }

          // Stop if we leave the table area
          if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao/i.test(line)) {
            break;
          }
        }
      }
    } catch (err) {
      logger.error('Error parsing monthly revenue text:', err);
    }

    return { totals, months };
  }

  /**
   * Extract month number from label like "Tháng 2 (đang diễn ra)" → 2
   */
  private static extractMonthNumber(label: string): number {
    const m = label.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  /**
   * Compute month_key in YYYY-MM format
   * YouTube Studio shows months in DESC order: current month first, then back in time
   * We need to figure out the year based on the month number pattern
   */
  private static computeMonthKey(monthNum: number, currentYear: number, indexInList: number): string {
    // The list is sorted DESC by date, so first item is most recent
    // Current month of Feb 2026: Tháng 2 = current, Tháng 1 = same year
    // Tháng 12 (before current) = previous year, etc.
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Calculate the actual date by going back from current month
    let targetMonth = currentMonth - indexInList;
    let targetYear = currentYear;

    while (targetMonth <= 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    // But we also have the actual month number from the label, use it for correction
    if (monthNum > 0) {
      // If monthNum is bigger than currentMonth and this isn't the first item,
      // it must be from the previous year
      if (monthNum > currentMonth || (monthNum === currentMonth && indexInList > 0)) {
        targetYear = currentYear - 1;
      } else {
        targetYear = currentYear;
      }
      // Check if we need to go further back
      const expectedMonth = currentMonth - indexInList;
      if (expectedMonth <= 0) {
        targetYear = currentYear + Math.floor((expectedMonth - 1) / 12);
      }
      targetMonth = monthNum;
    }

    return `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  }

  // ========================
  // ROW VALUE EXTRACTION (specific to monthly revenue table)
  // ========================

  private static extractRowValues(lines: string[], startIdx: number, maxValues: number): string[] {
    const values: string[] = [];
    for (let i = startIdx; i < Math.min(startIdx + maxValues + 5, lines.length); i++) {
      const line = lines[i];
      // Stop if we hit a month label or section header
      if (/^(Tháng|Month|Tổng|Total|Ngày|Day)/i.test(line)) break;
      // Value patterns  
      if (/[\d$%:₫]/.test(line) && line.length < 30) {
        values.push(line);
        if (values.length >= maxValues) break;
      }
      // Also handle dash (–) as no-data marker
      if (/^[–\-]$/.test(line.trim())) {
        values.push('–');
        if (values.length >= maxValues) break;
      }
    }
    return values;
  }

  // ========================
  // DATABASE OPERATIONS
  // ========================

  /**
   * Save monthly revenue data for a KOC
   */
  static async saveMonthlyRevenue(kocId: string, channelId: string, data: MonthlyRevenueData) {
    const saved: any[] = [];

    for (const month of data.months) {
      try {
        const result = await prisma.monthlyRevenueAnalytics.upsert({
          where: {
            koc_id_month_key: {
              koc_id: kocId,
              month_key: month.monthKey,
            },
          },
          update: {
            views: month.views != null ? BigInt(month.views) : null,
            views_percent: month.viewsPercent,
            watch_time_hours: month.watchTimeHours,
            watch_time_percent: month.watchTimePercent,
            avg_watch_time: month.avgWatchTime,
            estimated_revenue: month.estimatedRevenue,
            revenue_percent: month.revenuePercent,
            month_label: month.monthLabel,
            scraped_at: new Date(data.scrapedAt),
          },
          create: {
            koc_id: kocId,
            channel_id: channelId,
            month_label: month.monthLabel,
            month_key: month.monthKey,
            views: month.views != null ? BigInt(month.views) : null,
            views_percent: month.viewsPercent,
            watch_time_hours: month.watchTimeHours,
            watch_time_percent: month.watchTimePercent,
            avg_watch_time: month.avgWatchTime,
            estimated_revenue: month.estimatedRevenue,
            revenue_percent: month.revenuePercent,
            scraped_at: new Date(data.scrapedAt),
          },
        });
        saved.push(result);
      } catch (err: any) {
        logger.error(`Failed to save month ${month.monthKey} for KOC ${kocId}:`, err.message);
      }
    }

    logger.info(`💾 Saved ${saved.length} monthly revenue records for KOC ${kocId}`);
    return saved;
  }

  /**
   * Get monthly revenue analytics for a KOC
   */
  static async getByKOC(kocId: string) {
    const results = await prisma.monthlyRevenueAnalytics.findMany({
      where: { koc_id: kocId },
      orderBy: { month_key: 'desc' },
      include: {
        koc: {
          select: { full_name: true, channel_name: true, youtube_channel_id: true },
        },
      },
    });

    return results.map(r => ({
      ...r,
      views: r.views != null ? Number(r.views) : null,
      views_percent: r.views_percent != null ? Number(r.views_percent) : null,
      watch_time_hours: r.watch_time_hours != null ? Number(r.watch_time_hours) : null,
      watch_time_percent: r.watch_time_percent != null ? Number(r.watch_time_percent) : null,
      estimated_revenue: r.estimated_revenue != null ? Number(r.estimated_revenue) : null,
      revenue_percent: r.revenue_percent != null ? Number(r.revenue_percent) : null,
    }));
  }

  /**
   * Scrape and save monthly revenue for a single KOC
   */
  static async scrapeAndSave(kocId: string, channelId: string, adminId?: string): Promise<MonthlyRevenueData> {
    const data = await this.scrapeMonthlyRevenue(channelId, adminId);
    await this.saveMonthlyRevenue(kocId, channelId, data);
    return data;
  }

  /**
   * Scrape and save monthly revenue for all active KOCs
   */
  static async scrapeAllKOCs(adminId?: string): Promise<{
    results: Array<{ kocId: string; channelName: string; monthCount: number }>;
    errors: Array<{ kocId: string; channelName: string; error: string }>;
  }> {
    const kocs = await prisma.kOC.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true },
    });

    const results: Array<{ kocId: string; channelName: string; monthCount: number }> = [];
    const errors: Array<{ kocId: string; channelName: string; error: string }> = [];

    for (const koc of kocs) {
      try {
        logger.info(`📊 Scraping monthly revenue for ${koc.channel_name} (${koc.youtube_channel_id})`);
        const data = await this.scrapeAndSave(koc.id, koc.youtube_channel_id, adminId);
        results.push({
          kocId: koc.id,
          channelName: koc.channel_name,
          monthCount: data.months.length,
        });
        // Small delay between channels
        await new Promise(r => setTimeout(r, 2000));
      } catch (err: any) {
        logger.error(`❌ Failed for ${koc.channel_name}: ${err.message}`);
        errors.push({
          kocId: koc.id,
          channelName: koc.channel_name,
          error: err.message,
        });
        if (err.message === 'NOT_LOGGED_IN') break;
      }
    }

    return { results, errors };
  }
}
