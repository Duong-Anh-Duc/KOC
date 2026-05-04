import fs from 'fs';
import path from 'path';
import prisma from '../../config/database';
import logger from '../../middlewares/logger.middleware';
import type { MonthlyRevenueData, MonthlyRevenueRow } from '../../types/stats.types';
import {
  parseDecimalValue,
  parseIntegerValue,
  parsePercentValue,
  parseRevenueValue,
  parseTimeValue,
} from '../../utils/parseHelpers';
import { RevenueService } from '../revenue/revenue.service';
import { YouTubeScraperService } from './youtube-scraper.service';
import { GoogleAutoLoginService } from './google-login.service';

/** Timeout tunable qua env (xem SCRAPE_GOTO_TIMEOUT_MS / SCRAPE_POLL_TIMEOUT_MS trong .env). */
const SCRAPE_GOTO_TIMEOUT = parseInt(process.env.SCRAPE_GOTO_TIMEOUT_MS || '300000', 10);
const SCRAPE_POLL_TIMEOUT = parseInt(process.env.SCRAPE_POLL_TIMEOUT_MS || '600000', 10);

// Re-export types so existing imports from this file still work
export type { MonthlyRevenueData, MonthlyRevenueRow } from '../../types/stats.types';

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
    
    logger.info(`Scraping monthly revenue for channel: ${cleanId}`);

    const MAX_ATTEMPTS = 3;
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const context = await YouTubeScraperService.getContext(false, adminId);
      const page = await context.newPage();

      try {
        // Block heavy resources (images, fonts, media) to save RAM on VPS
        await page.route('**/*', (route) => {
          const type = route.request().resourceType();
          if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
            return route.abort();
          }
          return route.continue();
        });

        // Navigate to blank first to initialize page cleanly and reduce memory pressure
        try { await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }); } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 500));

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 1800000 });
        } catch (err: any) {
          logger.warn(`Page load timeout (attempt ${attempt}), continuing...`, err.message);
        }

        // Check login — thử auto-login nếu cấu hình
        if (page.url().includes('accounts.google.com')) {
          const ok = await GoogleAutoLoginService.ensureLoggedIn(page, url);
          if (!ok) throw new Error('NOT_LOGGED_IN');
        }

        // YouTube Studio shows "unsupported browser" page for headless/automated browsers.
        // Detect and click through to proceed to Studio directly.
        await new Promise(r => setTimeout(r, 3000));
        const bodySnippet = await page.evaluate('document.body.innerText').catch(() => '') as string;
        if (bodySnippet.includes('CHUYỂN THẲNG ĐẾN YOUTUBE STUDIO') || bodySnippet.includes('Go to YouTube Studio')) {
          logger.warn(`"Unsupported browser" page detected — clicking through to Studio...`);
          const link = page.locator('a:has-text("CHUYỂN THẲNG ĐẾN YOUTUBE STUDIO"), a:has-text("Go to YouTube Studio")');
          if (await link.count() > 0) {
            await link.first().click();
            await page.waitForLoadState('domcontentloaded').catch(() => {});
            await new Promise(r => setTimeout(r, 5000));
          } else {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 1800000 }).catch(() => {});
          }
        }

        // Wait for analytics to render — retry tối đa 10 lần, mỗi lần 15s (tổng ~2.5 phút)
        let text = '';
        for (let waitAttempt = 1; waitAttempt <= 10; waitAttempt++) {
          await new Promise(r => setTimeout(r, waitAttempt === 1 ? 8000 : 15000));
          text = await Promise.race([
            page.evaluate('document.body.innerText') as Promise<string>,
            new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout extracting text')), 1800000)
            ),
          ]);
          if (text.length >= 1000) break;
          logger.warn(`Content too short (${text.length} chars), waiting longer... (${waitAttempt}/10)`);
        }

        logger.info(`Scraped monthly revenue page (${text.length} chars)`);
        if (text.length < 500) {
          // Dump raw content to errors folder for debugging
          try {
            const errDir = path.join(process.cwd(), 'errors');
            if (!fs.existsSync(errDir)) fs.mkdirSync(errDir, { recursive: true });
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            fs.writeFileSync(path.join(errDir, `monthly_${cleanId}_${ts}.txt`), text, 'utf8');
            logger.warn(`[Debug] Raw page content saved to errors/monthly_${cleanId}_${ts}.txt`);
          } catch { /* ignore */ }
          throw new Error(`Page content too short (${text.length} chars) — data not loaded`);
        }

        // Navigate away to free memory
        try { await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }); } catch { /* ignore */ }

        // Parse the monthly revenue data
        const parsed = this.parseMonthlyRevenueText(text);

        return {
          channelId: cleanId,
          totals: parsed.totals,
          months: parsed.months,
          scrapedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        lastError = err;
        const isCrash = err.message?.includes('Target crashed') ||
                        err.message?.includes('Target closed') ||
                        err.message?.includes('Session closed') ||
                        err.message?.includes('existing browser session') ||
                        err.message?.includes('Opening in existing');

        if (err.message === 'NOT_LOGGED_IN') throw err; // no retry for auth errors

        if (isCrash && attempt < MAX_ATTEMPTS) {
          logger.warn(`Monthly scrape attempt ${attempt} crashed — clearing context and retrying in 5s...`);
          try { await page.close(); } catch { /* already dead */ }
          // Invalidate the corrupt context so getContext() creates a fresh one
          try {
            const ctx = await YouTubeScraperService.getContext(false, adminId).catch(() => null);
            if (ctx) await ctx.close();
          } catch { /* ignore */ }
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        throw err;
      } finally {
        try { await page.close(); } catch { /* ignore */ }
      }
    }

    throw lastError;
  }

  /**
   * Parse the monthly revenue explore page text.
   * Expected format (Vietnamese):
   *   Ngày ↓ | Số lượt xem | Thời gian xem (giờ) | Thời lượng xem trung bình | Doanh thu ước tính
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

    logger.info(`Saved ${saved.length} monthly revenue records for KOC ${kocId}`);
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
   * After saving monthly data, auto-sync revenue into matching open cycles.
   * monthKey format: "2026-01" → cycle month: "01/2026"
   */
  private static async syncToCycles(kocId: string, months: MonthlyRevenueRow[]) {
    let synced = 0;
    for (const month of months) {
      if (month.estimatedRevenue == null) continue;

      // Convert "2026-01" → "01/2026"
      const [year, mm] = month.monthKey.split('-');
      const cycleMonth = `${mm}/${year}`;

      try {
        // Find an OPEN cycle matching this month (scoped to the KOC's admin)
        const koc = await prisma.kOC.findUnique({ where: { id: kocId }, select: { admin_id: true, base_rate: true } });
        if (!koc) continue;

        const cycle = await prisma.revenueCycle.findFirst({
          where: { month: cycleMonth, status: 'OPEN', ...(koc.admin_id ? { admin_id: koc.admin_id } : {}) },
        });
        if (!cycle) continue;

        const record = await prisma.revenueRecord.findUnique({
          where: { koc_id_cycle_id: { koc_id: kocId, cycle_id: cycle.id } },
        });
        if (!record) continue;

        // Recalculate all derived fields with the new revenue
        const calculated = RevenueService.calculate({
          originalRevenueUsd: month.estimatedRevenue,
          usTaxDeduction: Number(record.us_tax_deduction),
          baseRate: Number(koc.base_rate),
          exchangeRate: Number(cycle.exchange_rate),
        });

        await prisma.revenueRecord.update({
          where: { id: record.id },
          data: calculated,
        });

        synced++;
        logger.info(`[MonthlySync] Updated cycle ${cycleMonth} record for KOC ${kocId}: $${month.estimatedRevenue}`);
      } catch (err: any) {
        logger.warn(`[MonthlySync] Failed to sync ${month.monthKey} for KOC ${kocId}: ${err.message}`);
      }
    }
    if (synced > 0) logger.info(`[MonthlySync] Synced ${synced} cycle record(s) for KOC ${kocId}`);
  }

  /**
   * Scrape and save monthly revenue for a single KOC
   */
  static async scrapeAndSave(kocId: string, channelId: string, adminId?: string, channelName?: string): Promise<MonthlyRevenueData> {
    let data: MonthlyRevenueData | null = null;
    let scrapeError: string | null = null;
    try {
      data = await this.scrapeMonthlyRevenue(channelId, adminId);
      await this.saveMonthlyRevenue(kocId, channelId, data);
      await this.syncToCycles(kocId, data.months);
    } catch (err: any) {
      scrapeError = err.message;
      throw err;
    } finally {
      this.writeMonthlyLog(channelId, channelName, data, scrapeError);
    }
    return data!;
  }

  private static writeMonthlyLog(channelId: string, channelName: string | undefined, data: MonthlyRevenueData | null, error: string | null): void {
    try {
      const logsDir = path.join(process.cwd(), 'logs', 'monthly');
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

      const label = (channelName || channelId).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u0300-\u036f\p{L}]/gu, '_');
      const year = new Date().getFullYear();
      const filePath = path.join(logsDir, `${label}_${year}.log`);

      const timestamp = new Date().toLocaleString('vi-VN');
      const lines: string[] = [];
      lines.push(`========================================`);
      lines.push(`Thời gian   : ${timestamp}`);
      lines.push(`Channel ID  : ${channelId}`);

      if (error) {
        lines.push(`Trạng thái  : THẤT BẠI`);
        lines.push(`Lỗi         : ${error}`);
      } else if (data) {
        lines.push(`Trạng thái  : THÀNH CÔNG (${data.months.length} tháng)`);
        for (const m of data.months) {
          lines.push(`  ${m.monthKey.padEnd(8)} DT: $${(m.estimatedRevenue ?? 0).toFixed(2).padStart(10)}  Views: ${(m.views ?? 0).toLocaleString()}`);
        }
      }
      lines.push('');
      fs.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
    } catch { /* ignore log errors */ }
  }

  /**
   * Scrape and save monthly revenue for all active KOCs
   */
  static async scrapeAllKOCs(
    adminId?: string,
    onProgress?: (current: number, total: number, channelName: string) => void,
    kocIds?: string[]
  ): Promise<{
    results: Array<{ kocId: string; channelName: string; monthCount: number }>;
    errors: Array<{ kocId: string; channelName: string; error: string }>;
  }> {
    const kocs = await prisma.kOC.findMany({
      where: {
        status: 'ACTIVE',
        ...(adminId ? { admin_id: adminId } : {}),
        ...(kocIds && kocIds.length > 0 ? { id: { in: kocIds } } : {}),
      },
      select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true },
    });

    const results: Array<{ kocId: string; channelName: string; monthCount: number }> = [];
    const errors: Array<{ kocId: string; channelName: string; error: string }> = [];
    const total = kocs.length;
    if (total === 0) return { results, errors };

    const BATCH_SIZE = 3;
    logger.info(`[Monthly Parallel] Tổng ${total} KOC, mỗi batch ${BATCH_SIZE} tab...`);

    const context = await YouTubeScraperService.getContext(false, adminId);
    let progressCount = 0;

    try {
      for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
        const batchKocs = kocs.slice(batchStart, batchStart + BATCH_SIZE);
        const batchLen = batchKocs.length;
        const pages: any[] = new Array(batchLen).fill(null);

        logger.info(`[Monthly Parallel] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: ${batchLen} tab [${batchKocs.map(k => k.channel_name).join(', ')}]`);

        // Mở tab và navigate
        await Promise.all(batchKocs.map(async (koc, i) => {
          const page = await context.newPage();
          pages[i] = page;

          await page.route('**/*', (route: any) => {
            const t = route.request().resourceType();
            if (['image', 'font', 'media', 'stylesheet'].includes(t)) return route.abort();
            return route.continue();
          }).catch(() => {});

          const url = this.buildMonthlyRevenueUrl(koc.youtube_channel_id);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: SCRAPE_GOTO_TIMEOUT }).catch((e: any) => {
            logger.warn(`[Monthly Parallel] Navigate ${koc.channel_name} lỗi: ${e.message}`);
          });
          logger.info(`[Monthly Parallel] Tab ${batchStart + i + 1}/${total} đã load: ${koc.channel_name}`);
        }));

        // minimizeWindow removed (GemLogin manages browser)

        // Poll đợi nội dung
        const POLL_MS = 5000;
        const WAIT_LIMIT = Date.now() + SCRAPE_POLL_TIMEOUT;
        const pageReady = new Array(batchLen).fill(false);

        while (!pageReady.every(Boolean) && Date.now() < WAIT_LIMIT) {
          await new Promise(r => setTimeout(r, POLL_MS));
          for (let i = 0; i < batchLen; i++) {
            if (pageReady[i] || !pages[i]) continue;
            try {
              const text: string = await pages[i].evaluate('document.body.innerText') as string;
              if (text.length >= 1000) {
                pageReady[i] = true;
                logger.info(`[Monthly Parallel] Tab ${batchStart + i + 1} (${batchKocs[i].channel_name}) sẵn sàng: ${text.length} chars`);
              }
            } catch { /* vẫn đang load */ }
          }
          const ready = pageReady.filter(Boolean).length;
          logger.info(`[Monthly Parallel] Batch: ${ready}/${batchLen} tab sẵn sàng`);
        }

        // Extract + lưu và đóng tab
        await Promise.allSettled(pages.map(async (page, i) => {
          const koc = batchKocs[i];
          try {
            const text: string = await page.evaluate('document.body.innerText') as string;
            if (text.length < 500) {
              throw new Error(`Page content too short (${text.length} chars)`);
            }
            const parsed = this.parseMonthlyRevenueText(text);
            const data: MonthlyRevenueData = {
              channelId: YouTubeScraperService.cleanChannelId(koc.youtube_channel_id),
              totals: parsed.totals,
              months: parsed.months,
              scrapedAt: new Date().toISOString(),
            };
            await this.saveMonthlyRevenue(koc.id, koc.youtube_channel_id, data);
            await this.syncToCycles(koc.id, data.months);
            this.writeMonthlyLog(koc.youtube_channel_id, koc.channel_name, data, null);
            progressCount++;
            if (onProgress) onProgress(progressCount, total, koc.channel_name);
            results.push({ kocId: koc.id, channelName: koc.channel_name, monthCount: data.months.length });
            logger.info(`[Monthly Parallel] ${koc.channel_name}: ${data.months.length} tháng`);
          } catch (err: any) {
            const errMsg: string = err.message ?? String(err);
            logger.error(`[Monthly Parallel] ${koc.channel_name}: ${errMsg}`);
            this.writeMonthlyLog(koc.youtube_channel_id, koc.channel_name, null, errMsg);
            errors.push({ kocId: koc.id, channelName: koc.channel_name, error: errMsg });
            // Session disconnect tracking removed (GemLogin manages sessions)
          } finally {
            try { await page.close(); } catch { /* ignore */ }
          }
        }));

        // Delay giữa các batch
        if (batchStart + BATCH_SIZE < total) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    } catch (err: any) {
      throw err;
    }

    logger.info(`[Monthly Parallel] Hoàn tất: ${results.length} thành công, ${errors.length} lỗi`);
    return { results, errors };
  }
}
