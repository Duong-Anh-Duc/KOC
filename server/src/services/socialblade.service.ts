import fs from 'fs';
import path from 'path';
import { Page } from 'playwright';
import prisma from '../config/database';
import { ApiError } from '../middlewares';
import logger from '../middlewares/logger.middleware';
import type {
    ChannelStats28dData,
    ColumnSpec,
    CountryStatsRow,
    CountryStatsTotals,
    DayStatsRow,
    DayStatsTotals,
} from '../types/stats.types';
import {
    isCountryName,
    isDateLine,
    isValueLine,
    parseDimensionRowValues,
    parseTotalRow,
} from '../utils/parseHelpers';
import { ExchangeRateService } from './exchange-rate.service';
import { ProgressService } from './progress.service';
import { YouTubeScraperService } from './youtube-scraper.service';

// Re-export types so existing imports from this file still work
export type {
    ChannelStats28dData,
    CountryStatsRow,
    CountryStatsTotals,
    DayStatsRow,
    DayStatsTotals
} from '../types/stats.types';

// ============================================================
// Column Specs for Table Parsing
// ============================================================

/**
 * Country table column order (15 columns):
 * Subs Gained, Subs Lost, Likes, Dislikes, Like%, Shares,
 * New Viewers, Returning Viewers, Avg Watch Time,
 * Views, Watch Time (hrs), Subscribers Net,
 * Est Revenue, Thumbnail Impressions, Thumbnail CTR
 */
const COUNTRY_COL_SPECS: ColumnSpec[] = [
  { key: 'subscribersGained', type: 'number_percent' },
  { key: 'subscribersLost', type: 'number_percent' },
  { key: 'likes', type: 'number_percent' },
  { key: 'dislikes', type: 'number_percent' },
  { key: 'likeRatio', type: 'standalone_percent_or_dash' },
  { key: 'shares', type: 'number_percent' },
  { key: 'newViewers', type: 'standalone_num_or_dash' },
  { key: 'returningViewers', type: 'standalone_num_or_dash' },
  { key: 'avgWatchTime', type: 'standalone_time' },
  { key: 'views', type: 'number_percent' },
  { key: 'watchTimeHours', type: 'number_percent' },
  { key: 'subscribersNet', type: 'number_percent' },
  { key: 'estimatedRevenue', type: 'dollar_percent' },
  { key: 'thumbnailImpressions', type: 'standalone_num_or_dash' },
  { key: 'thumbnailCTR', type: 'standalone_percent_or_dash' },
];

/**
 * Day table column order (4 columns):
 * Views, Watch Time (hrs), Avg Watch Time, Est Revenue
 */
const DAY_COL_SPECS: ColumnSpec[] = [
  { key: 'views', type: 'number_percent' },
  { key: 'watchTimeHours', type: 'number_percent' },
  { key: 'avgWatchTime', type: 'standalone_time' },
  { key: 'estimatedRevenue', type: 'dollar_percent' },
];

// ============================================================
// Service
// ============================================================

export class SocialBladeService {

  // ============================================================
  // URL BUILDERS
  // ============================================================

  /**
   * Build URL for 28-day explore by country
   */
  private static buildCountryExploreUrl(channelId: string): string {
    const id = YouTubeScraperService.cleanChannelId(channelId);
    return `https://studio.youtube.com/channel/${id}/analytics/tab-earn_revenue/period-default/explore?c=${id}&entity_type=CHANNEL&entity_id=${id}&time_period=4_weeks&explore_type=TABLE_AND_CHART&chart_type=LINE_CHART&metric=SUBSCRIBERS_GAINED&granularity=DAY&t_metrics=SUBSCRIBERS_GAINED&t_metrics=SUBSCRIBERS_LOST&t_metrics=RATINGS_LIKES&t_metrics=RATINGS_DISLIKES&t_metrics=LIKES_PER_LIKES_PLUS_DISLIKES_PERCENT&t_metrics=SHARINGS&t_metrics=RECENT_VIEWERS&t_metrics=RETURNING_VIEWERS&t_metrics=AVERAGE_WATCH_TIME&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=SUBSCRIBERS_NET_CHANGE&t_metrics=TOTAL_ESTIMATED_EARNINGS&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS_VTR&dimension=COUNTRY&o_column=SUBSCRIBERS_GAINED&o_direction=ANALYTICS_ORDER_DIRECTION_DESC`;
  }

  /**
   * Build URL for 28-day explore by day
   */
  private static buildDayExploreUrl(channelId: string): string {
    const id = YouTubeScraperService.cleanChannelId(channelId);
    return `https://studio.youtube.com/channel/${id}/analytics/tab-earn_revenue/period-default/explore?c=${id}&entity_type=CHANNEL&entity_id=${id}&time_period=4_weeks&explore_type=TABLE_AND_CHART&chart_type=LINE_CHART&metric=EXTERNAL_VIEWS&granularity=DAY&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=AVERAGE_WATCH_TIME&t_metrics=TOTAL_ESTIMATED_EARNINGS&dimension=DAY&o_column=DAY&o_direction=ANALYTICS_ORDER_DIRECTION_DESC`;
  }

  // ============================================================
  // PAGE SCRAPING
  // ============================================================

  /**
   * Navigate to an explore page and extract body text
   */
  private static async scrapeExplorePage(page: Page, url: string, label: string): Promise<string> {
    logger.info(`📊 Scraping ${label}...`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    } catch (err: any) {
      logger.warn(`⚠️ Page load warning for ${label}: ${err.message}`);
    }

    if (page.url().includes('accounts.google.com')) {
      throw new Error('NOT_LOGGED_IN');
    }

    // Click through "unsupported browser" page if shown
    await new Promise(r => setTimeout(r, 1500));
    const bodyCheck = await page.evaluate('document.body.innerText').catch(() => '') as string;
    if (bodyCheck.includes('CHUYỂN THẲNG ĐẾN YOUTUBE STUDIO') || bodyCheck.includes('Go to YouTube Studio')) {
      logger.warn(`⚠️ "Unsupported browser" page detected for ${label} — clicking through...`);
      const link = page.locator('a:has-text("CHUYỂN THẲNG ĐẾN YOUTUBE STUDIO"), a:has-text("Go to YouTube Studio")');
      if (await link.count() > 0) {
        await link.first().click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await new Promise(r => setTimeout(r, 3000));
      } else {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 1800000 }).catch(() => {});
      }
    }

    // Poll mỗi 5s tối đa 3 phút — đợi bảng analytics load xong (có dòng "Tổng")
    logger.info(`⏳ Polling ${label} for analytics table...`);
    let text = '';
    const deadline = Date.now() + 180000;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        text = await page.evaluate('document.body.innerText') as string;
      } catch { break; }

      // Bảng đã load nếu có dòng "Tổng" (standalone, không phải "Tổng quan")
      const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const hasTong = lines.some((l: string) => /^Tổng$|^Total$/i.test(l));
      if (hasTong) {
        logger.info(`✓ Analytics table loaded for ${label} (${text.length} chars)`);
        break;
      }
      logger.info(`⏳ Waiting for table [${label}]... (${text.length} chars, no Tổng row yet)`);
    }

    if (!text) {
      text = await page.evaluate('document.body.innerText').catch(() => '') as string;
    }

    logger.info(`✓ ${label}: extracted ${text.length} chars`);
    return text;
  }

  // ============================================================
  // COUNTRY TABLE PARSER
  // ============================================================

  /**
   * Parse the by-country explore table text
   */
  private static parseCountryExploreText(text: string): {
    totals: CountryStatsTotals;
    rows: CountryStatsRow[];
  } {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const nullTotals: CountryStatsTotals = {
      subscribersGained: null, subscribersLost: null, likes: null, dislikes: null,
      likeRatio: null, shares: null, newViewers: null, returningViewers: null,
      avgWatchTime: null, views: null, watchTimeHours: null, subscribersNet: null,
      estimatedRevenue: null, thumbnailImpressions: null, thumbnailCTR: null,
    };

    // Find "Tổng" (Total) row
    let totalIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^(Tổng|Total)$/i.test(lines[i]) && i + 1 < lines.length && isValueLine(lines[i + 1])) {
        totalIdx = i;
        logger.info(`✓ Found "Tổng" row at index ${i}: "${lines[i]}"`);
        break;
      }
    }

    if (totalIdx === -1) {
      logger.warn('⚠️ Could not find "Tổng" row in country explore text');
      logger.warn(`📄 Total lines: ${lines.length}`);
      logger.warn(`📄 First 20 lines: ${lines.slice(0, 20).join(' | ')}`);
      logger.warn(`📄 Lines containing "Tổng" or "Total": ${lines.filter(l => /tổng|total/i.test(l)).join(' | ')}`);
      return { totals: nullTotals, rows: [] };
    }

    // Collect total row values (15 values max, scan up to 50 lines)
    const totalValues: string[] = [];
    const maxScanLines = Math.min(totalIdx + 50, lines.length);
    let lastValueLineIdx = totalIdx;
    for (let i = totalIdx + 1; i < maxScanLines && totalValues.length < 15; i++) {
      const line = lines[i];
      // Stop if we hit UI elements or section breaks
      if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode|Mostrar gráfico|Ocultar gráfico|Modo avanzado/i.test(line)) break;
      if (/xác minh|danh tính|tìm hiểu|tiếp theo|verificar|identidad|más información|siguiente|verify|identity|learn more|next|continue|confirmar|información/i.test(line)) break;
      // Stop if we encounter a country name (start of dimension rows)
      if (isCountryName(line)) break;
      // Skip date lines (headers)
      if (isDateLine(line)) continue;
      // Collect value lines
      if (isValueLine(line)) {
        totalValues.push(line.trim());
        lastValueLineIdx = i;
      }
      // Continue scanning even for non-value lines (don't break immediately)
    }

    logger.info(`📊 Collected ${totalValues.length} total values: ${totalValues.join(' | ')}`);
    const totals = parseTotalRow(totalValues, COUNTRY_COL_SPECS);
    logger.info(`📋 Country totals parsed: views=${totals.views}, subsGained=${totals.subscribersGained}, subsNet=${totals.subscribersNet}, revenue=${totals.estimatedRevenue}`);

    // Parse country rows (start after last total value line)
    const rows: CountryStatsRow[] = [];
    let i = lastValueLineIdx + 1;

    while (i < lines.length) {
      const line = lines[i];
      // Stop at UI elements or verification prompts (Vietnamese, English, Spanish)
      if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode|Mostrar gráfico|Ocultar gráfico|Modo avanzado/i.test(line)) break;
      if (/xác minh|danh tính|tìm hiểu|tiếp theo|verificar|identidad|más información|siguiente|verify|identity|learn more|next|continue|confirmar|información/i.test(line)) break;

      if (isCountryName(line)) {
        const country = line;
        i++;
        const values: string[] = [];
        while (i < lines.length && isValueLine(lines[i])) {
          values.push(lines[i].trim());
          i++;
        }
        const row = parseDimensionRowValues(country, values, COUNTRY_COL_SPECS, 'country') as CountryStatsRow;
        rows.push(row);
      } else {
        i++;
      }
    }

    logger.info(`📋 Parsed ${rows.length} country rows`);
    return { totals: totals as CountryStatsTotals, rows };
  }

  // ============================================================
  // DAY TABLE PARSER
  // ============================================================

  /**
   * Parse the by-day explore table text
   */
  private static parseDayExploreText(text: string): {
    totals: DayStatsTotals;
    rows: DayStatsRow[];
  } {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const nullTotals: DayStatsTotals = {
      views: null, watchTimeHours: null, avgWatchTime: null, estimatedRevenue: null,
    };

    // Find "Tổng" (Total) row
    let totalIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^(Tổng|Total)$/i.test(lines[i]) && i + 1 < lines.length && isValueLine(lines[i + 1])) {
        totalIdx = i;
        logger.info(`✓ Found "Tổng" row at index ${i}: "${lines[i]}"`);
        break;
      }
    }

    if (totalIdx === -1) {
      logger.warn('⚠️ Could not find "Tổng" row in day explore text');
      logger.warn(`📄 Total lines: ${lines.length}`);
      logger.warn(`📄 First 20 lines: ${lines.slice(0, 20).join(' | ')}`);
      logger.warn(`📄 Lines containing "Tổng" or "Total": ${lines.filter(l => /tổng|total/i.test(l)).join(' | ')}`);
      return { totals: nullTotals, rows: [] };
    }

    // Collect total row values (4 values max, scan up to 30 lines)
    const totalValues: string[] = [];
    const maxScanLines = Math.min(totalIdx + 30, lines.length);
    let lastValueLineIdx = totalIdx;
    for (let i = totalIdx + 1; i < maxScanLines && totalValues.length < 4; i++) {
      const line = lines[i];
      // Stop if we hit UI elements or section breaks
      if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode|Mostrar gráfico|Ocultar gráfico|Modo avanzado/i.test(line)) break;
      if (/xác minh|danh tính|tìm hiểu|tiếp theo|verificar|identidad|más información|siguiente|verify|identity|learn more|next|continue|confirmar|información/i.test(line)) break;
      // Stop if we encounter a date line (start of dimension rows)
      if (isDateLine(line)) break;
      // Skip country names (shouldn't be in day table but just in case)
      if (isCountryName(line)) continue;
      // Collect value lines
      if (isValueLine(line)) {
        totalValues.push(line.trim());
        lastValueLineIdx = i;
      }
      // Continue scanning even for non-value lines (don't break immediately)
    }

    logger.info(`📊 Collected ${totalValues.length} total values: ${totalValues.join(' | ')}`);
    const totals = parseTotalRow(totalValues, DAY_COL_SPECS);
    logger.info(`📋 Day totals parsed: views=${totals.views}, subsGained=${totals.subscribersGained}, subsNet=${totals.subscribersNet}, revenue=${totals.estimatedRevenue}`);

    // Parse day rows (start after last total value line)
    const rows: DayStatsRow[] = [];
    let i = lastValueLineIdx + 1;

    while (i < lines.length) {
      const line = lines[i];
      // Stop at UI elements or verification prompts (Vietnamese, English, Spanish)
      if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode|Mostrar gráfico|Ocultar gráfico|Modo avanzado/i.test(line)) break;
      if (/xác minh|danh tính|tìm hiểu|tiếp theo|verificar|identidad|más información|siguiente|verify|identity|learn more|next|continue|confirmar|información/i.test(line)) break;

      if (isDateLine(line)) {
        const date = line;
        i++;
        const values: string[] = [];
        while (i < lines.length && isValueLine(lines[i])) {
          values.push(lines[i].trim());
          i++;
        }
        const row = parseDimensionRowValues(date, values, DAY_COL_SPECS, 'day') as DayStatsRow;
        rows.push(row);
      } else {
        i++;
      }
    }

    logger.info(`📋 Parsed ${rows.length} day rows`);
    return { totals: totals as DayStatsTotals, rows };
  }

  // ============================================================
  // MAIN SCRAPING METHOD
  // ============================================================

  /**
   * Scrape both explore tables (by country + by day) for a channel
   */
  static async scrapeChannelStats(channelId: string, adminId?: string, channelName?: string): Promise<ChannelStats28dData> {
    const context = await YouTubeScraperService.getContext(false, adminId);
    const page = await context.newPage();

    let result: ChannelStats28dData | null = null;
    let scrapeError: string | null = null;

    try {
      // 1. Scrape country table
      const countryUrl = this.buildCountryExploreUrl(channelId);
      const countryText = await this.scrapeExplorePage(page, countryUrl, `country stats [${channelId}]`);
      const countryData = this.parseCountryExploreText(countryText);

      // 2. Scrape day table
      const dayUrl = this.buildDayExploreUrl(channelId);
      const dayText = await this.scrapeExplorePage(page, dayUrl, `day stats [${channelId}]`);
      const dayData = this.parseDayExploreText(dayText);

      result = { byCountry: countryData, byDay: dayData, scrapedAt: new Date().toISOString() };
      return result;
    } catch (err: any) {
      scrapeError = err.message;
      throw err;
    } finally {
      try { await page.close(); } catch { /* ignore */ }
      this.write28DayLog(channelId, channelName, result, scrapeError);
    }
  }

  private static write28DayLog(channelId: string, channelName: string | undefined, data: ChannelStats28dData | null, error: string | null): void {
    try {
      const logsDir = path.join(process.cwd(), 'logs', '28days');
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

      const label = (channelName || channelId).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u0300-\u036f\p{L}]/gu, '_');
      const dateTag = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const filePath = path.join(logsDir, `${label}_${dateTag}.log`);

      const timestamp = new Date().toLocaleString('vi-VN');
      const lines: string[] = [];
      lines.push(`========================================`);
      lines.push(`Thời gian   : ${timestamp}`);
      lines.push(`Channel ID  : ${channelId}`);

      if (error) {
        lines.push(`Trạng thái  : ❌ THẤT BẠI`);
        lines.push(`Lỗi         : ${error}`);
      } else if (data) {
        const t = data.byCountry.totals;
        lines.push(`Trạng thái  : ✅ THÀNH CÔNG`);
        lines.push(`Lượt xem    : ${(t.views ?? 0).toLocaleString()}`);
        lines.push(`Giờ xem     : ${t.watchTimeHours ?? 0}`);
        lines.push(`Doanh thu   : $${(t.estimatedRevenue ?? 0).toFixed(2)}`);
        lines.push(`Ngày cào    : ${data.byDay.rows.length} ngày`);
        if (data.byCountry.rows.length > 0) {
          lines.push(`--- Theo quốc gia (top 5) ---`);
          for (const r of data.byCountry.rows.slice(0, 5)) {
            lines.push(`  ${(r.country ?? '').padEnd(20)} $${(r.estimatedRevenue ?? 0).toFixed(2)}`);
          }
        }
      }
      lines.push('');
      fs.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
    } catch { /* ignore log errors */ }
  }

  // ============================================================
  // DATABASE METHODS
  // ============================================================

  /**
   * Fetch and save 28d stats for a single KOC
   */
  static async recordStats(kocId: string, adminId?: string) {
    const koc = await prisma.kOC.findUnique({ where: { id: kocId } });
    if (!koc) throw new ApiError(404, 'koc.notFound');

    const stats = await this.scrapeChannelStats(koc.youtube_channel_id, adminId, koc.channel_name);

    const record = await prisma.channelStat.create({
      data: {
        koc_id: kocId,
        view_count: stats.byCountry.totals.views || 0,
        sub_count: stats.byCountry.totals.subscribersNet || 0,
        yt_analytics: stats as any,
      },
    });

    return record;
  }

  /**
   * Fetch and save 28d stats for all active KOCs (parallel — opens all tabs at once)
   */
  static async recordAllStats(adminId?: string) {
    const kocs = await prisma.kOC.findMany({ where: { status: 'ACTIVE', ...(adminId ? { admin_id: adminId } : {}) } });
    const results: any[] = [];
    const errors: { kocId: string; channelName: string; error: string }[] = [];

    logger.info(`📊 Starting PARALLEL 28d stats for ${kocs.length} KOCs...`);

    const context = await YouTubeScraperService.getContext(false, adminId);

    // Open all pages
    const pages: { koc: typeof kocs[0]; page: Page; countryData?: { totals: CountryStatsTotals; rows: CountryStatsRow[] }; dayData?: { totals: DayStatsTotals; rows: DayStatsRow[] }; error?: string }[] = [];
    for (const koc of kocs) {
      try {
        const page = await context.newPage();
        pages.push({ koc, page });
      } catch (err: any) {
        errors.push({ kocId: koc.id, channelName: koc.channel_name, error: `Failed to open page: ${err.message}` });
      }
    }

    // Navigate all to country URLs
    await Promise.all(pages.map(async (entry) => {
      try {
        const url = this.buildCountryExploreUrl(entry.koc.youtube_channel_id);
        await entry.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
        if (entry.page.url().includes('accounts.google.com')) {
          entry.error = 'NOT_LOGGED_IN';
        }
      } catch (err: any) {
        entry.error = err.message;
      }
    }));

    // Check NOT_LOGGED_IN
    if (pages.some(p => p.error === 'NOT_LOGGED_IN')) {
      logger.error('❌ NOT_LOGGED_IN detected — aborting');
      YouTubeScraperService.markSessionDisconnected('28day_scrape_not_logged_in', undefined, adminId, {
        trigger: 'SocialBladeService.recordAllStats_parallel',
      }).catch(() => {});
      for (const entry of pages) { try { await entry.page.close(); } catch {} }
      return { success: 0, failed: kocs.length, errors: [{ kocId: '', channelName: '', error: 'NOT_LOGGED_IN' }] };
    }

    // Poll country tables
    await this.pollAllPagesForTable(pages.filter(p => !p.error).map(p => ({ page: p.page, label: p.koc.channel_name })));

    // Extract country data
    for (const entry of pages) {
      if (entry.error) continue;
      try {
        const text = await entry.page.evaluate('document.body.innerText').catch(() => '') as string;
        entry.countryData = this.parseCountryExploreText(text);
      } catch (err: any) {
        entry.error = `Country extract failed: ${err.message}`;
      }
    }

    // Navigate all to day URLs
    await Promise.all(pages.map(async (entry) => {
      if (entry.error) return;
      try {
        const url = this.buildDayExploreUrl(entry.koc.youtube_channel_id);
        await entry.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
      } catch (err: any) {
        entry.error = `Day navigate failed: ${err.message}`;
      }
    }));

    // Poll day tables
    await this.pollAllPagesForTable(pages.filter(p => !p.error).map(p => ({ page: p.page, label: p.koc.channel_name })));

    // Extract day data and save
    for (const entry of pages) {
      if (entry.error) {
        errors.push({ kocId: entry.koc.id, channelName: entry.koc.channel_name, error: entry.error });
        try { await entry.page.close(); } catch {}
        continue;
      }
      try {
        const text = await entry.page.evaluate('document.body.innerText').catch(() => '') as string;
        entry.dayData = this.parseDayExploreText(text);

        const stats: ChannelStats28dData = {
          byCountry: entry.countryData!,
          byDay: entry.dayData,
          scrapedAt: new Date().toISOString(),
        };

        this.write28DayLog(entry.koc.youtube_channel_id, entry.koc.channel_name, stats, null);

        const record = await prisma.channelStat.create({
          data: {
            koc_id: entry.koc.id,
            view_count: stats.byCountry.totals.views || 0,
            sub_count: stats.byCountry.totals.subscribersNet || 0,
            yt_analytics: stats as any,
          },
        });

        results.push(record);
        logger.info(`✅ 28d stats saved for ${entry.koc.channel_name} (${results.length}/${kocs.length})`);
      } catch (err: any) {
        errors.push({ kocId: entry.koc.id, channelName: entry.koc.channel_name, error: String(err) });
        logger.error(`❌ Failed for ${entry.koc.channel_name}: ${err}`);
      } finally {
        try { await entry.page.close(); } catch {}
      }
    }

    logger.info(`📊 Stats completed: ${results.length} success, ${errors.length} failed`);
    return { success: results.length, failed: errors.length, errors };
  }

  /**
   * Same as recordAllStats but emits SSE progress events via ProgressService.
   * Opens ALL KOC tabs at once for parallel scraping.
   */
  static async recordAllStatsWithProgress(taskId: string, adminId?: string) {
    const kocs = await prisma.kOC.findMany({ where: { status: 'ACTIVE', ...(adminId ? { admin_id: adminId } : {}) } });
    const total = kocs.length;
    const results: string[] = [];
    const errors: { kocId: string; channelName: string; error: string }[] = [];

    logger.info(`📊 Starting PARALLEL 28d stats for ${total} KOCs (taskId: ${taskId})...`);

    ProgressService.emit(taskId, {
      step: 0,
      total: total * 2, // country + day = 2 phases
      percent: 0,
      message: `Đang mở ${total} tab song song...`,
    });

    const context = await YouTubeScraperService.getContext(false, adminId);

    // --- Phase 1: Open all pages and navigate to COUNTRY URLs ---
    const pages: { koc: typeof kocs[0]; page: Page; countryData?: { totals: CountryStatsTotals; rows: CountryStatsRow[] }; dayData?: { totals: DayStatsTotals; rows: DayStatsRow[] }; error?: string }[] = [];

    for (const koc of kocs) {
      try {
        const page = await context.newPage();
        pages.push({ koc, page });
      } catch (err: any) {
        errors.push({ kocId: koc.id, channelName: koc.channel_name, error: `Failed to open page: ${err.message}` });
      }
    }

    // Navigate all pages to country URLs simultaneously
    logger.info(`📊 Navigating ${pages.length} pages to country explore URLs...`);
    await Promise.all(pages.map(async (entry) => {
      try {
        const url = this.buildCountryExploreUrl(entry.koc.youtube_channel_id);
        await entry.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});

        // Check for login redirect
        if (entry.page.url().includes('accounts.google.com')) {
          entry.error = 'NOT_LOGGED_IN';
          return;
        }

        // Handle "unsupported browser" page
        await new Promise(r => setTimeout(r, 1500));
        const bodyCheck = await entry.page.evaluate('document.body.innerText').catch(() => '') as string;
        if (bodyCheck.includes('CHUYỂN THẲNG ĐẾN YOUTUBE STUDIO') || bodyCheck.includes('Go to YouTube Studio')) {
          const link = entry.page.locator('a:has-text("CHUYỂN THẲNG ĐẾN YOUTUBE STUDIO"), a:has-text("Go to YouTube Studio")');
          if (await link.count() > 0) {
            await link.first().click();
            await entry.page.waitForLoadState('domcontentloaded').catch(() => {});
            await new Promise(r => setTimeout(r, 3000));
          }
        }
      } catch (err: any) {
        entry.error = err.message;
      }
    }));

    // Check if any page hit NOT_LOGGED_IN
    const notLoggedIn = pages.find(p => p.error === 'NOT_LOGGED_IN');
    if (notLoggedIn) {
      logger.error('❌ NOT_LOGGED_IN detected — aborting all tabs');
      YouTubeScraperService.markSessionDisconnected('28day_scrape_not_logged_in', undefined, adminId, {
        trigger: 'SocialBladeService.recordAllStatsWithProgress_parallel',
      }).catch(() => {});
      for (const entry of pages) {
        try { await entry.page.close(); } catch { /* ignore */ }
      }
      const resultData = { success: 0, failed: total, errors: [{ kocId: '', channelName: '', error: 'NOT_LOGGED_IN' }] };
      ProgressService.complete(taskId, resultData);
      return resultData;
    }

    // Poll all pages until country tables are loaded
    logger.info(`⏳ Polling ${pages.length} pages for country tables...`);
    const activePagesCountry = pages.filter(p => !p.error);
    await this.pollAllPagesForTable(activePagesCountry.map(p => ({ page: p.page, label: p.koc.channel_name })));

    // Extract country data from all pages
    let countryDone = 0;
    for (const entry of pages) {
      if (entry.error) continue;
      try {
        const text = await entry.page.evaluate('document.body.innerText').catch(() => '') as string;
        entry.countryData = this.parseCountryExploreText(text);
        countryDone++;
        ProgressService.emit(taskId, {
          step: countryDone,
          total: total * 2,
          percent: Math.round((countryDone / (total * 2)) * 100),
          message: `Country data: ${entry.koc.channel_name} (${countryDone}/${total})`,
        });
        logger.info(`✅ Country data extracted for ${entry.koc.channel_name}`);
      } catch (err: any) {
        entry.error = `Country extract failed: ${err.message}`;
      }
    }

    // --- Phase 2: Navigate all pages to DAY URLs ---
    logger.info(`📊 Navigating ${pages.length} pages to day explore URLs...`);
    await Promise.all(pages.map(async (entry) => {
      if (entry.error) return;
      try {
        const url = this.buildDayExploreUrl(entry.koc.youtube_channel_id);
        await entry.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
      } catch (err: any) {
        entry.error = `Day navigate failed: ${err.message}`;
      }
    }));

    // Poll all pages until day tables are loaded
    logger.info(`⏳ Polling ${pages.length} pages for day tables...`);
    const activePagesDays = pages.filter(p => !p.error);
    await this.pollAllPagesForTable(activePagesDays.map(p => ({ page: p.page, label: p.koc.channel_name })));

    // Extract day data and save to DB
    for (const entry of pages) {
      if (entry.error) {
        errors.push({ kocId: entry.koc.id, channelName: entry.koc.channel_name, error: entry.error });
        try { await entry.page.close(); } catch { /* ignore */ }
        continue;
      }

      try {
        const text = await entry.page.evaluate('document.body.innerText').catch(() => '') as string;
        entry.dayData = this.parseDayExploreText(text);

        const stats: ChannelStats28dData = {
          byCountry: entry.countryData!,
          byDay: entry.dayData,
          scrapedAt: new Date().toISOString(),
        };

        this.write28DayLog(entry.koc.youtube_channel_id, entry.koc.channel_name, stats, null);

        await prisma.channelStat.create({
          data: {
            koc_id: entry.koc.id,
            view_count: stats.byCountry.totals.views || 0,
            sub_count: stats.byCountry.totals.subscribersNet || 0,
            yt_analytics: stats as any,
          },
        });

        results.push(entry.koc.id);
        const doneCount = results.length + errors.length;
        ProgressService.emit(taskId, {
          step: total + results.length,
          total: total * 2,
          percent: Math.round(((total + doneCount) / (total * 2)) * 100),
          message: `Đã lưu: ${entry.koc.channel_name} (${results.length}/${total})`,
        });
        logger.info(`✅ 28d stats saved for ${entry.koc.channel_name} (${results.length}/${total})`);
      } catch (err: any) {
        errors.push({ kocId: entry.koc.id, channelName: entry.koc.channel_name, error: String(err) });
        logger.error(`❌ Failed to save stats for ${entry.koc.channel_name}: ${err}`);
        this.write28DayLog(entry.koc.youtube_channel_id, entry.koc.channel_name, null, String(err));
      } finally {
        try { await entry.page.close(); } catch { /* ignore */ }
      }
    }

    const resultData = { success: results.length, failed: errors.length, errors };
    logger.info(`📊 Stats completed: ${results.length} success, ${errors.length} failed`);
    ProgressService.complete(taskId, resultData);
    return resultData;
  }

  /**
   * Poll multiple pages in parallel until their analytics tables load (have "Tổng" row).
   * Timeout: 3 minutes per page.
   */
  private static async pollAllPagesForTable(entries: { page: Page; label: string }[]): Promise<void> {
    const deadline = Date.now() + 180000; // 3 minutes
    const pending = new Set(entries.map((_, i) => i));

    while (pending.size > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000));

      const checks = Array.from(pending).map(async (idx) => {
        const { page, label } = entries[idx];
        try {
          const text = await page.evaluate('document.body.innerText') as string;
          const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
          const hasTong = lines.some((l: string) => /^Tổng$|^Total$/i.test(l));
          if (hasTong) {
            logger.info(`✓ Table loaded for ${label}`);
            pending.delete(idx);
          }
        } catch {
          // page may have crashed — skip
          pending.delete(idx);
        }
      });

      await Promise.all(checks);

      if (pending.size > 0) {
        const remaining = Array.from(pending).map(i => entries[i].label).join(', ');
        logger.info(`⏳ Still waiting for ${pending.size} pages: ${remaining}`);
      }
    }

    if (pending.size > 0) {
      const timedOut = Array.from(pending).map(i => entries[i].label).join(', ');
      logger.warn(`⚠️ Timed out waiting for tables: ${timedOut}`);
    }
  }

  // ============================================================
  // QUERY METHODS
  // ============================================================

  /**
   * Get channel stats history
   */
  static async getStatsHistory(kocId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const stats = await prisma.channelStat.findMany({
      where: {
        koc_id: kocId,
        recorded_at: { gte: since },
      },
      orderBy: { recorded_at: 'asc' },
    });

    return stats.map(stat => ({
      ...stat,
      view_count: stat.view_count != null ? Number(stat.view_count) : null,
      sub_count: stat.sub_count != null ? Number(stat.sub_count) : null,
    }));
  }

  /**
   * Get latest stats for all KOCs
   */
  static async getLatestStats(adminId?: string) {
    const where: any = { status: 'ACTIVE' as const };
    if (adminId) where.admin_id = adminId;

    const kocs = await prisma.kOC.findMany({
      where,
      include: {
        channel_stats: {
          orderBy: { recorded_at: 'desc' },
          take: 1,
        },
      },
    });

    return kocs.map((koc) => ({
      koc_id: koc.id,
      full_name: koc.full_name,
      channel_name: koc.channel_name,
      latest_stats: koc.channel_stats[0] || null,
    }));
  }

  /**
   * Get 28d growth summary for all KOCs
   * Supports both new (byCountry/byDay) and old (overview/content/audience) formats
   */
  private static normalizeRevenueToUsd(val: number | null | undefined): number {
    if (!val) return 0;
    // If value exceeds realistic USD threshold (5000), assume it's raw VND and convert
    if (val > 5000) {
      return ExchangeRateService.convertVndToUsd(val) || 0;
    }
    return val; // Already in USD
  }

  /**
   * Get 28d growth summary for all KOCs
   * Supports both new (byCountry/byDay) and old (overview/content/audience) formats
   */
  static async getAllKocsGrowth(adminId?: string) {
    const where: any = { status: 'ACTIVE' as const };
    if (adminId) where.admin_id = adminId;

    const kocs = await prisma.kOC.findMany({
      where,
      include: {
        channel_stats: {
          orderBy: { recorded_at: 'desc' },
          take: 1,
        },
      },
    });

    return kocs.map((koc) => {
      const latest = koc.channel_stats[0] || null;
      const yt = latest?.yt_analytics as any;
      const isNewFormat = yt?.byCountry !== undefined;

      if (isNewFormat) {
        const ct = yt.byCountry?.totals as CountryStatsTotals | undefined;
        return {
          koc_id: koc.id,
          full_name: koc.full_name,
          channel_name: koc.channel_name,
          youtube_channel_id: koc.youtube_channel_id,
          views_28d_num: ct?.views || 0,
          watch_time_hours_28d_num: ct?.watchTimeHours || 0,
          subs_gained_28d_num: ct?.subscribersGained || 0,
          subs_lost_28d_num: ct?.subscribersLost || 0,
          subs_net_28d_num: ct?.subscribersNet || 0,
          estimated_revenue_28d_num: this.normalizeRevenueToUsd(ct?.estimatedRevenue),
          likes_28d_num: ct?.likes || 0,
          shares_28d_num: ct?.shares || 0,
          has_data: true,
          last_recorded_at: latest?.recorded_at || null,
        };
      } else if (yt?.overview) {
        // Backward compat for old format
        return {
          koc_id: koc.id,
          full_name: koc.full_name,
          channel_name: koc.channel_name,
          youtube_channel_id: koc.youtube_channel_id,
          views_28d_num: yt.overview.views28d_num || 0,
          watch_time_hours_28d_num: yt.overview.watchTimeHours28d_num || 0,
          subs_gained_28d_num: yt.overview.subscribers28d_num || 0,
          subs_lost_28d_num: 0,
          subs_net_28d_num: yt.overview.subscribers28d_num || 0,
          estimated_revenue_28d_num: this.normalizeRevenueToUsd(yt.overview.estimatedRevenue28d_num),
          likes_28d_num: yt.content?.likes28d_num || 0,
          shares_28d_num: 0,
          has_data: true,
          last_recorded_at: latest?.recorded_at || null,
        };
      } else {
        return {
          koc_id: koc.id,
          full_name: koc.full_name,
          channel_name: koc.channel_name,
          youtube_channel_id: koc.youtube_channel_id,
          views_28d_num: 0,
          watch_time_hours_28d_num: 0,
          subs_gained_28d_num: 0,
          subs_lost_28d_num: 0,
          subs_net_28d_num: 0,
          estimated_revenue_28d_num: 0,
          likes_28d_num: 0,
          shares_28d_num: 0,
          has_data: false,
          last_recorded_at: latest?.recorded_at || null,
        };
      }
    }).sort((a, b) => b.views_28d_num - a.views_28d_num);
  }

  /**
   * Get detailed 28d stats for a single KOC (country + day breakdown)
   */
  static async getKocDetail(kocId: string) {
    const koc = await prisma.kOC.findUnique({
      where: { id: kocId },
      include: {
        channel_stats: {
          orderBy: { recorded_at: 'desc' },
          take: 1,
        },
      },
    });
    if (!koc) throw new ApiError(404, 'koc.notFound');

    const latest = koc.channel_stats[0] || null;
    const yt = latest?.yt_analytics as any;
    const isNewFormat = yt?.byCountry !== undefined;

    return {
      koc_id: koc.id,
      full_name: koc.full_name,
      channel_name: koc.channel_name,
      youtube_channel_id: koc.youtube_channel_id,
      byCountry: isNewFormat ? yt.byCountry : null,
      byDay: isNewFormat ? yt.byDay : null,
      has_data: isNewFormat,
      last_recorded_at: latest?.recorded_at || null,
    };
  }

  /**
   * Get correlation data between views growth and revenue for a KOC
   */
  static async getCorrelation(kocId: string, months: number = 6) {
    const koc = await prisma.kOC.findUnique({ where: { id: kocId } });
    if (!koc) throw new ApiError(404, 'koc.notFound');

    const records = await prisma.revenueRecord.findMany({
      where: { koc_id: kocId },
      include: { cycle: { select: { month: true, exchange_rate: true } } },
      orderBy: { created_at: 'desc' },
      take: months,
    });

    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const stats = await prisma.channelStat.findMany({
      where: { koc_id: kocId, recorded_at: { gte: since } },
      orderBy: { recorded_at: 'asc' },
    });

    const statsByMonth: Record<string, { totalViews: number; totalSubs: number }> = {};
    for (const stat of stats) {
      const date = new Date(stat.recorded_at);
      const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      statsByMonth[monthKey] = {
        totalViews: Number(stat.view_count),
        totalSubs: Number(stat.sub_count),
      };
    }

    const correlation = records.reverse().map((record) => ({
      month: record.cycle.month,
      revenue_usd: Number(record.original_revenue_usd),
      koc_receive_usd: Number(record.koc_receive_usd),
      views: statsByMonth[record.cycle.month]?.totalViews || 0,
      subscribers: statsByMonth[record.cycle.month]?.totalSubs || 0,
    }));

    return {
      koc_id: kocId,
      full_name: koc.full_name,
      channel_name: koc.channel_name,
      data: correlation,
    };
  }
}
