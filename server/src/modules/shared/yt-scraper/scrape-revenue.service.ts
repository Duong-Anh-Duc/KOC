/**
 * Revenue scraping methods: scrapeAnalytics, scrapeMultipleChannels,
 * scrapeMultipleChannelsParallel, URL/channel helpers, parsing.
 */
import fs from 'fs';
import path from 'path';
import { Page } from 'playwright';
import logger from '../../../middlewares/logger.middleware';
import { ExchangeRateService } from '../exchange-rate.service';
import { YouTubeAnalyticsData, RevenueByCountry, safeClosePage } from './types';
import {
  contexts,
  scrapingInProgress,
} from './shared-state';
import {
  getContext,
  markSessionVerified,
  minimizeWindow,
} from './browser-context.service';
// Session management removed (using GemLogin profiles)
const markSessionDisconnected = (..._args: any[]) => Promise.resolve();

// ============================================================
// KOC LOGGING
// ============================================================

/** Write per-KOC scrape log to src/logs/{label}_{month}.log */
export function writeKocLog(
  channelId: string,
  month: string | undefined,
  data: YouTubeAnalyticsData | null,
  error: string | null,
  channelLabels?: Map<string, string>
): void {
  try {
    const logsDir = path.join(process.cwd(), 'logs', 'revenue');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

    const label = (channelLabels?.get(channelId) || channelId).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u0300-\u036f\p{L}]/gu, '_');
    const monthTag = (month || 'unknown').replace('/', '-');
    const filePath = path.join(logsDir, `${label}_${monthTag}.log`);

    const timestamp = new Date().toLocaleString('vi-VN');
    const lines: string[] = [];
    lines.push(`========================================`);
    lines.push(`Thoi gian   : ${timestamp}`);
    lines.push(`Channel ID  : ${channelId}`);
    lines.push(`Thang       : ${month || 'unknown'}`);

    if (error) {
      lines.push(`Trang thai  : THAT BAI`);
      lines.push(`Loi         : ${error}`);
    } else if (data) {
      lines.push(`Trang thai  : THANH CONG`);
      lines.push(`Doanh thu   : $${data.totals.estimatedRevenue ?? 0}`);
      lines.push(`Luot xem    : ${data.totals.views ?? 0}`);
      lines.push(`Gio xem     : ${data.totals.watchTimeHours ?? 0}`);
      lines.push(`TG xem TB   : ${data.totals.avgWatchTime ?? '-'}`);
      if (data.countries && data.countries.length > 0) {
        lines.push(`--- Doanh thu theo quoc gia ---`);
        for (const c of data.countries) {
          lines.push(`  ${c.country.padEnd(20)} $${c.estimatedRevenue ?? 0}  (${c.revenuePercent ?? 0}%)`);
        }
      }
    }
    lines.push('');

    fs.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  } catch (err: any) {
    logger.warn(`[Log] Failed to write KOC log for ${channelId}: ${err.message}`);
  }
}

// ============================================================
// URL / CHANNEL HELPERS
// ============================================================

export function cleanChannelId(raw: string): string {
  let id = raw.trim();
  const qIdx = id.indexOf('?');
  if (qIdx !== -1) id = id.substring(0, qIdx);
  const hIdx = id.indexOf('#');
  if (hIdx !== -1) id = id.substring(0, hIdx);
  const urlMatch = id.match(
    /(?:youtube\.com\/channel\/|studio\.youtube\.com\/channel\/)([A-Za-z0-9_-]+)/
  );
  if (urlMatch) id = urlMatch[1];
  return id.trim();
}

export function buildRevenueExploreUrl(
  channelId: string,
  month?: string
): string {
  const cleanId = cleanChannelId(channelId);
  let timePeriodParam = 'time_period=minus_1_month';

  if (month) {
    let mm: string, yyyy: string;
    if (month.includes('/')) {
      [mm, yyyy] = month.split('/');
    } else if (month.includes('-')) {
      [yyyy, mm] = month.split('-');
    } else {
      mm = month; yyyy = String(new Date().getFullYear());
    }
    const year = parseInt(yyyy, 10);
    const mon = parseInt(mm, 10);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const minus1 =
      currentMonth - 1 <= 0
        ? { m: currentMonth - 1 + 12, y: currentYear - 1 }
        : { m: currentMonth - 1, y: currentYear };
    const minus2 =
      currentMonth - 2 <= 0
        ? { m: currentMonth - 2 + 12, y: currentYear - 1 }
        : { m: currentMonth - 2, y: currentYear };

    if (mon === minus1.m && year === minus1.y) {
      timePeriodParam = 'time_period=minus_1_month';
      logger.info(
        `Month ${month} matches minus_1_month — using native time period`
      );
    } else if (mon === minus2.m && year === minus2.y) {
      timePeriodParam = 'time_period=minus_2_month';
      logger.info(
        `Month ${month} matches minus_2_month — using native time period`
      );
    } else {
      const startDate = `${yyyy}-${mm}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const endDate = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
      timePeriodParam = `time_period=custom&start_date=${startDate}&end_date=${endDate}`;
      logger.info(
        `Month ${month} doesn't match recent months — using custom date range`
      );
    }
  }

  return `https://studio.youtube.com/channel/${cleanId}/analytics/tab-earn_revenue/period-default/explore?entity_type=CHANNEL&entity_id=${cleanId}&${timePeriodParam}&explore_type=TABLE_AND_CHART&metric=TOTAL_ESTIMATED_EARNINGS&granularity=DAY&t_metrics=TOTAL_ESTIMATED_EARNINGS&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=AVERAGE_WATCH_TIME&dimension=COUNTRY&o_column=TOTAL_ESTIMATED_EARNINGS&o_direction=ANALYTICS_ORDER_DIRECTION_DESC`;
}

// ============================================================
// SCRAPING
// ============================================================

/**
 * Navigate to revenue explore page and extract page text
 */
async function scrapeRevenueExplore(
  page: Page,
  channelId: string,
  month?: string
): Promise<string> {
  const url = buildRevenueExploreUrl(channelId, month);
  logger.info(
    `Scraping revenue explore for channel: ${channelId}${month ? ` (month: ${month})` : ''}`
  );

  // Navigate to blank first to reduce memory pressure
  try { await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }); } catch { /* ignore */ }
  // Random pre-navigation delay (1-3s) to mimic human pace
  await new Promise(r => setTimeout(r, 1000 + Math.floor(Math.random() * 2000)));

  try {
    logger.info('Navigating to revenue explore page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 1800000 });
    logger.info(`Page loaded, current URL: ${page.url()}`);
  } catch (err: any) {
    logger.warn(
      `Page load timeout/error, continuing anyway... URL: ${page.url()}`,
      err.message
    );
  }

  const currentUrl = page.url();
  if (currentUrl.includes('accounts.google.com')) {
    const bodySnippet = await page.evaluate(() => document.body?.innerText?.substring(0, 200)).catch(() => '') as string;
    logger.warn(`[Scrape] Redirected to login for channel ${channelId}: ${currentUrl}`);
    logger.warn(`[Scrape] Page snippet: ${bodySnippet.substring(0, 200)}`);
    throw new Error('NOT_LOGGED_IN');
  }

  // Verify we actually navigated to the correct channel page
  const cleanId = cleanChannelId(channelId);
  if (!currentUrl.includes(cleanId) && !currentUrl.includes('about:blank')) {
    logger.warn(`Navigation failed — expected channel ${cleanId} but got: ${currentUrl}`);
    throw new Error(`NAVIGATION_FAILED: Page did not navigate to channel ${cleanId}`);
  }

  // Wait for analytics table to render
  logger.info('Waiting for analytics to render...');
  try {
    await page.waitForSelector('[role="row"], ytd-app, #page-manager', { timeout: 15000 });
    logger.info('Page ready, waiting 4s for analytics data...');
    await new Promise(r => setTimeout(r, 4000));
  } catch {
    logger.info('Selector timeout, using 12s fallback...');
    await new Promise(r => setTimeout(r, 12000));
  }

  // Scroll to trigger lazy-loaded elements (needed in headless mode)
  try {
    await page.evaluate('window.scrollTo(0, 400)');
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate('window.scrollTo(0, 0)');
  } catch { /* ignore */ }

  // Stop all background network loading to freeze RAM usage before extraction
  try { await page.evaluate(() => window.stop()); } catch { /* ignore */ }
  await new Promise(r => setTimeout(r, 500));

  logger.info('Extracting text...');
  let text = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    text = await Promise.race([
      page.evaluate(`(function() {
        var SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'DEFS', 'USE']);
        function rowText(el) {
          if (SKIP_TAGS.has(el.tagName)) return '';
          if (el.offsetParent === null) {
            var cs = window.getComputedStyle(el);
            if (cs.display === 'none') return '';
          }
          var parts = [];
          for (var i = 0; i < el.childNodes.length; i++) {
            var child = el.childNodes[i];
            if (child.nodeType === 3) {
              var t = (child.textContent || '').trim();
              if (t) parts.push(t);
            } else if (child.nodeType === 1) {
              parts.push(rowText(child));
            }
          }
          return parts.join(' ');
        }
        var scopeSelectors = [
          'ytd-analytics-multi-dimension-data-table-renderer',
          'ytd-analytics-main-app',
          '#analytics-content-container',
          'main',
          '#page-manager',
          'ytd-app'
        ];
        for (var s = 0; s < scopeSelectors.length; s++) {
          var el = document.querySelector(scopeSelectors[s]);
          if (el) {
            var rowEls = el.querySelectorAll('tr, [role="row"]');
            if (rowEls.length > 3) {
              return Array.from(rowEls).map(function(r) { return rowText(r); }).join('\\n');
            }
          }
        }
        var allRows = document.querySelectorAll('tr, [role="row"]');
        if (allRows.length > 3) {
          return Array.from(allRows).map(function(r) { return rowText(r); }).join('\\n');
        }
        return document.body.innerText;
      })()`) as Promise<string>,
      new Promise<string>((_, reject) =>
        setTimeout(
          () => reject(new Error('Timeout extracting text (exceeded 60s)')),
          60000
        )
      ),
    ]);
    if (text && text.trim().length > 50) break;
    logger.warn(
      `Text extraction attempt ${attempt}: only ${text.length} chars, waiting 5s more...`
    );
    await new Promise(r => setTimeout(r, 5000));
  }

  // Navigate away immediately to free page memory
  try { await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }); } catch { /* ignore */ }

  logger.info(`Scraped revenue explore (${text.length} chars)`);
  return text;
}

/**
 * Scrape YouTube Studio revenue explore page for a single channel
 */
export async function scrapeAnalytics(
  channelId: string,
  month?: string,
  adminId?: string
): Promise<YouTubeAnalyticsData> {
  let page: Page | null = null;
  try {
    const context = await getContext(true, adminId);
    page = await context.newPage();

    // Block heavy resources to save RAM
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    logger.info(
      `Starting scrape for channel: ${channelId}${month ? ` (month: ${month})` : ''}`
    );

    const result = await scrapeChannelWithPage(page, channelId, month);
    return result;
  } finally {
    await safeClosePage(page);
  }
}

/**
 * Scrape multiple channels sequentially - REUSES same page for efficiency
 */
export async function scrapeMultipleChannels(
  channelIds: string[],
  month?: string,
  onProgress?: (channelId: string, index: number, total: number) => void,
  adminId?: string,
  channelLabels?: Map<string, string>
): Promise<{
  results: YouTubeAnalyticsData[];
  errors: Array<{ channelId: string; error: string }>;
}> {
  const results: YouTubeAnalyticsData[] = [];
  const errors: Array<{ channelId: string; error: string }> = [];
  const total = channelIds.length;

  // Pause KeepAlive to avoid RAM competition during batch scrape
  const scrapeKey = adminId || '__default__';
  scrapingInProgress.set(scrapeKey, true);

  /**
   * Helper: open fresh page -> block heavy resources -> scrape one channel -> close page.
   */
  const scrapeOneChannel = async (channelId: string): Promise<YouTubeAnalyticsData> => {
    let page: Page | null = null;
    try {
      const context = await getContext(true, adminId);
      page = await context.newPage();

      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
          return route.abort();
        }
        return route.continue();
      });

      const result = await scrapeChannelWithPage(page, channelId, month);
      return result;
    } finally {
      await safeClosePage(page);
    }
  };

  /**
   * SOFT reset: navigate all open pages to about:blank and close extras.
   */
  const softReset = async () => {
    const existingCtx = contexts.get(adminId || '__default__');
    if (!existingCtx) return;
    try {
      const pages = existingCtx.pages();
      if (pages.length === 0) return;

      try {
        await pages[0].goto('about:blank', { waitUntil: 'commit', timeout: 3000 });
      } catch { /* ignore */ }

      for (let idx = 1; idx < pages.length; idx++) {
        try {
          await pages[idx].goto('about:blank', { waitUntil: 'commit', timeout: 2000 });
          await pages[idx].close();
        } catch { /* ignore */ }
      }

      logger.info(`[Memory] Soft reset: navigated ${pages.length} page(s) to blank, kept 1 holder open`);
    } catch (err: any) {
      logger.warn(`[Memory] Soft reset failed: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 3000));
  };

  /**
   * HARD reset: used ONLY when a crash is detected.
   */
  const resetContext = async () => {
    const existingCtx = contexts.get(adminId || '__default__');
    if (existingCtx) {
      try { await existingCtx.close(); } catch { /* ignore */ }
      contexts.delete(adminId || '__default__');
    }
    try {
      const { execSync } = require('child_process');
      execSync('pkill -9 -f chromium || true', { stdio: 'ignore', timeout: 5000 });
      logger.info('Killed zombie chromium processes');
    } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 5000));
  };

  /**
   * Navigate studio.youtube.com to fully restore session from persistent profile.
   */
  const warmUpSession = async (reason: string) => {
    logger.info(`Warming up browser session (${reason})...`);
    let warmPage: Page | null = null;
    try {
      const context = await getContext(true, adminId);
      warmPage = await context.newPage();
      await warmPage.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(type)) return route.abort();
        return route.continue();
      });
      await warmPage.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 1800000 });
      const warmUrl = warmPage.url();
      if (warmUrl.includes('accounts.google.com')) {
        const bodySnippet = await warmPage.evaluate(() => document.body?.innerText?.substring(0, 300)).catch(() => '') as string;
        logger.error(`[WarmUp] Session expired — redirected to: ${warmUrl}`);
        logger.error(`[WarmUp] Page snippet: ${bodySnippet.substring(0, 200)}`);
        try {
          const logDir = path.join(process.cwd(), 'logs', 'session-errors');
          fs.mkdirSync(logDir, { recursive: true });
          const now = new Date();
          const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
          const logFile = path.join(logDir, `${now.toISOString().substring(0, 10)}.log`);
          fs.appendFileSync(logFile, [
            `\n${'='.repeat(60)}`,
            `[${dateStr}] WARMUP REDIRECT DETECTED`,
            `  Admin   : ${adminId || 'default'}`,
            `  Reason  : ${reason}`,
            `  URL     : ${warmUrl}`,
            `  Snippet : ${bodySnippet.substring(0, 300)}`,
            '',
          ].join('\n') + '\n');
        } catch { /* ignore */ }
        throw new Error('NOT_LOGGED_IN');
      }
      await new Promise(r => setTimeout(r, 3000));
      await safeClosePage(warmPage);
      logger.info('Browser session warm-up complete');
    } catch (err: any) {
      if (warmPage) await safeClosePage(warmPage).catch(() => {});
      if (err.message === 'NOT_LOGGED_IN') throw err;
      logger.warn(`Warm-up failed (continuing anyway): ${err.message}`);
    }
  };

  try {
    const existingCtxForWarmCheck = contexts.get(adminId || '__default__');
    const isContextCold = !existingCtxForWarmCheck || existingCtxForWarmCheck.pages().length === 0;
    if (isContextCold) {
      await warmUpSession('cold start');
    } else {
      logger.info('Browser context already warm — skipping studio warm-up');
    }

    const CONCURRENCY = total > 10 ? 1 : 2;
    const BATCH_DELAY_MS = total > 10 ? 8000 : 4000;
    const SESSION_REFRESH_EVERY = 5;

    const chunks: string[][] = [];
    for (let i = 0; i < channelIds.length; i += CONCURRENCY) {
      chunks.push(channelIds.slice(i, i + CONCURRENCY));
    }

    logger.info(
      `Starting batch scrape: ${total} channels, concurrency=${CONCURRENCY}, batchDelay=${BATCH_DELAY_MS}ms (${chunks.length} batches)${month ? ` — month ${month}` : ''}`
    );

    let sessionExpired = false;

    for (let batchIdx = 0; batchIdx < chunks.length; batchIdx++) {
      if (sessionExpired) break;

      const chunk = chunks[batchIdx];
      const batchStart = batchIdx * CONCURRENCY;

      logger.info(`[Batch ${batchIdx + 1}/${chunks.length}] Scraping ${chunk.length} channels in parallel: ${chunk.join(', ')}`);

      chunk.forEach((channelId, idx) => {
        if (onProgress) onProgress(channelId, batchStart + idx, total);
      });

      const chunkResults = await Promise.allSettled(
        chunk.map(channelId => scrapeOneChannel(channelId))
      );

      for (let j = 0; j < chunkResults.length; j++) {
        const channelId = chunk[j];
        const r = chunkResults[j];
        if (r.status === 'fulfilled') {
          results.push(r.value);
          logger.info(`[Batch ${batchIdx + 1}] OK ${channelId}`);
          writeKocLog(channelId, month, r.value, null, channelLabels);
        } else {
          const errMsg = r.reason?.message || 'Unknown error';
          errors.push({ channelId, error: errMsg });
          logger.warn(`[Batch ${batchIdx + 1}] FAIL ${channelId}: ${errMsg}`);
          writeKocLog(channelId, month, null, errMsg, channelLabels);
          if (errMsg === 'NOT_LOGGED_IN') sessionExpired = true;
        }
      }

      if (sessionExpired) {
        logger.warn('NOT_LOGGED_IN detected in batch — verifying session...');
        try {
          await warmUpSession('session verify after NOT_LOGGED_IN');
          logger.info('Session still valid — will retry failed channels in retry pass');
          sessionExpired = false;
        } catch (verifyErr: any) {
          if (verifyErr.message === 'NOT_LOGGED_IN') {
            logger.error('Session truly expired — stopping scrape.');
            const failedChannels = errors.filter(e => e.error === 'NOT_LOGGED_IN').map(e => e.channelId);
            markSessionDisconnected('scrape_not_logged_in', undefined, adminId, {
              trigger: 'scrapeAllKOCs',
              batchIdx: String(batchIdx),
              totalBatches: String(chunks.length),
              failedChannels: failedChannels.join(', '),
              verifyError: verifyErr.message,
            }).catch(() => {});
            break;
          }
          sessionExpired = false;
        }
      }

      if (batchIdx < chunks.length - 1 && !sessionExpired) {
        await softReset();

        if ((batchIdx + 1) % SESSION_REFRESH_EVERY === 0) {
          logger.info(`[Session] Refreshing session after batch ${batchIdx + 1} to avoid rate-limit...`);
          try {
            await warmUpSession(`periodic refresh after ${batchIdx + 1} batches`);
          } catch { /* ignore — scrape continues */ }
        }

        const jitter = Math.floor(Math.random() * 3000);
        const delay = BATCH_DELAY_MS + jitter;
        logger.info(`[Throttle] Waiting ${delay}ms before next batch...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // -- RETRY PASS: retry failed channels once (skip NOT_LOGGED_IN) --
    const retryableErrors = errors.filter(e => !e.error.includes('NOT_LOGGED_IN'));
    if (retryableErrors.length > 0) {
      const failedChannels = retryableErrors.map(e => e.channelId);
      logger.info(`Retrying ${failedChannels.length} failed channel(s)...`);

      for (let i = 0; i < failedChannels.length; i++) {
        const channelId = failedChannels[i];
        try {
          logger.info(`[Retry ${i + 1}/${failedChannels.length}] Channel: ${channelId}`);
          const data = await scrapeOneChannel(channelId);
          results.push(data);
          const errIdx = errors.findIndex(e => e.channelId === channelId);
          if (errIdx >= 0) errors.splice(errIdx, 1);
          logger.info(`[Retry ${i + 1}/${failedChannels.length}] OK Recovered`);
          if (i < failedChannels.length - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch (retryErr: any) {
          logger.warn(`[Retry ${i + 1}/${failedChannels.length}] FAIL Still failed: ${retryErr.message}`);
          const isCrash = retryErr.message?.includes('Target crashed') ||
                          retryErr.message?.includes('Target closed') ||
                          retryErr.message?.includes('SCRAPE_TIMEOUT');
          if (isCrash) await resetContext();
        }
      }

      const recovered = failedChannels.length - errors.filter(e => !e.error.includes('NOT_LOGGED_IN')).length;
      logger.info(`Retry done: ${recovered} recovered`);
    }

    logger.info(`Batch complete: ${results.length} success, ${errors.length} failed`);

    if (results.length > 0) {
      markSessionVerified(adminId);
      logger.info(`Session verified after batch scrape for admin ${adminId || 'default'}`);
    }

    return { results, errors };
  } finally {
    try {
      await softReset();
      logger.info('[Memory] Post-batch soft reset done — context ready for next request');
    } catch (rErr: any) {
      logger.warn(`[Memory] Post-batch soft reset failed (non-fatal): ${rErr.message}`);
    }
    scrapingInProgress.set(scrapeKey, false);
    logger.debug('Batch scrape complete. Persistent context kept alive for next scrape.');
  }
}

// ============================================================
// PRIVATE HELPERS
// ============================================================

/**
 * Core scraping logic - uses provided page (reusable for batch operations)
 */
async function scrapeChannelWithPage(
  page: Page,
  channelId: string,
  month?: string
): Promise<YouTubeAnalyticsData> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error('SCRAPE_TIMEOUT: Exceeded 90 seconds')),
      90000
    );
  });

  const scrapePromise = (async () => {
    try {
      const rawText = await scrapeRevenueExplore(
        page,
        channelId,
        month
      );
      const parsed = parseRevenueExploreText(rawText);

      const result: YouTubeAnalyticsData = {
        channelId,
        totals: parsed.totals,
        countries: parsed.countries,
        period: parsed.period,
        rawText,
        scrapedAt: new Date().toISOString(),
      };

      logger.info(
        `Successfully scraped revenue explore for channel: ${channelId}`,
        {
          revenue: parsed.totals.estimatedRevenue,
          views: parsed.totals.views,
          countries: parsed.countries.length,
        }
      );

      return result;
    } catch (error: any) {
      if (error.message === 'NOT_LOGGED_IN') {
        logger.warn('Not logged in to YouTube Studio');
        throw new Error('NOT_LOGGED_IN');
      }
      if (error.message?.includes('SCRAPE_TIMEOUT')) {
        logger.error(`Timeout scraping ${channelId}`);
        throw new Error('SCRAPE_TIMEOUT');
      }
      logger.error(`Failed to scrape analytics for ${channelId}:`, error);
      throw error;
    }
  })();

  return Promise.race([scrapePromise, timeoutPromise]);
}

// ============================================================
// PARSING
// ============================================================

function parseRevenueExploreText(text: string): {
  totals: YouTubeAnalyticsData['totals'];
  countries: RevenueByCountry[];
  period: string;
} {
  const totals: YouTubeAnalyticsData['totals'] = {
    estimatedRevenue: null,
    views: null,
    watchTimeHours: null,
    avgWatchTime: null,
  };
  const countries: RevenueByCountry[] = [];
  let period = '';

  const logPath: string | null = null;
  let logContent = `=== REVENUE PARSING LOG ===\nTime: ${new Date().toISOString()}\n\n`;

  try {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    logContent += `Total lines in text: ${lines.length}\n\n`;
    logContent += `=== RAW TEXT ===\n${lines.join('\n')}\n\n=== PARSING ===\n`;

    for (const line of lines) {
      const periodMatch = line.match(
        /(\d+\s*[–-]\s*\d+\s*thg\s*\d+,?\s*\d{4})/i
      );
      if (periodMatch) {
        period = periodMatch[1];
        break;
      }
      const monthMatch = line.match(/^Tháng\s+\d+$/i);
      if (monthMatch) {
        period = line;
      }
    }

    let inTable = false;
    let foundTotal = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        /^Địa lý$|^Geography$/i.test(line) ||
        /Doanh thu ước tính|Estimated revenue/i.test(line)
      ) {
        inTable = true;
        continue;
      }

      if (!inTable) continue;

      if (/^Tổng$|^Total$/i.test(line) && !foundTotal) {
        foundTotal = true;
        logContent += `\nFOUND TOTAL ROW at line ${i}\n`;
        logContent += `Next lines for extraction:\n`;
        for (
          let j = i + 1;
          j < Math.min(i + 10, lines.length);
          j++
        ) {
          logContent += `  [${j}]: "${lines[j]}"\n`;
        }
        const rowValues = extractTableRowValues(lines, i + 1, 4);
        logContent += `\nExtracted values: [${rowValues.map((v) => `"${v}"`).join(', ')}] (count: ${rowValues.length})\n`;
        logger.info(
          `TOTAL ROW - Raw values: [${rowValues.join(', ')}]`
        );
        if (rowValues.length >= 1) {
          const revParsed = parseRevenueValue(rowValues[0]);
          totals.estimatedRevenue = revParsed;
          logContent += `  [0] "${rowValues[0]}" -> Revenue = ${revParsed}\n`;
          logger.info(
            `   [Total] Revenue field: "${rowValues[0]}" -> ${totals.estimatedRevenue}`
          );
        }
        if (rowValues.length >= 2) {
          const viewsParsed = parseIntegerValue(rowValues[1]);
          totals.views = viewsParsed;
          logContent += `  [1] "${rowValues[1]}" -> Views = ${viewsParsed}\n`;
          logger.info(
            `   [Total] Views field: "${rowValues[1]}" -> ${totals.views}`
          );
        }
        if (rowValues.length >= 3) {
          const wtParsed = parseDecimalValue(rowValues[2]);
          totals.watchTimeHours = wtParsed;
          logContent += `  [2] "${rowValues[2]}" -> WatchTime = ${wtParsed}\n`;
          logger.info(
            `   [Total] WatchTime field: "${rowValues[2]}" -> ${totals.watchTimeHours}`
          );
        }
        if (rowValues.length >= 4) {
          totals.avgWatchTime = parseTimeValue(rowValues[3]);
          logContent += `  [3] "${rowValues[3]}" -> AvgTime = ${totals.avgWatchTime}\n`;
        }
        logContent += `\nFinal totals: revenue=${totals.estimatedRevenue}, views=${totals.views}, watchTime=${totals.watchTimeHours}\n`;
        logger.info(
          `   [Total] Final: revenue=${totals.estimatedRevenue}, views=${totals.views}`
        );
        continue;
      }

      if (foundTotal) {
        if (isCountryName(line)) {
          const country = line;
          const rowValues = extractTableRowValues(lines, i + 1, 8);
          logContent += `\nCountry: ${country}\n`;
          logContent += `  Raw values: [${rowValues.map((v) => `"${v}"`).join(', ')}]\n`;
          logger.info(`Parsing country: ${country}`);
          logger.info(`   Raw values: [${rowValues.join(', ')}]`);

          const countryData: RevenueByCountry = {
            country,
            estimatedRevenue: null,
            revenuePercent: null,
            views: null,
            viewsPercent: null,
            watchTimeHours: null,
            watchTimePercent: null,
            avgWatchTime: null,
          };

          let valueIdx = 0;
          for (let v = 0; v < rowValues.length && valueIdx < 7; v++) {
            const val = rowValues[v];
            logger.debug(
              `   [v=${v}, idx=${valueIdx}] Processing: "${val}"`
            );

            if (valueIdx === 0) {
              if (val === '-') {
                countryData.estimatedRevenue = 0;
                valueIdx = 2;
                logger.debug(
                  '     -> Revenue = 0 (dash), skip to idx=2'
                );
              } else if (/\$/.test(val) || /₫/.test(val)) {
                countryData.estimatedRevenue = parseRevenueValue(val);
                valueIdx = 1;
                logger.debug(
                  `     -> Revenue = ${countryData.estimatedRevenue}, move to idx=1`
                );
              } else if (/^[\d.,]+$/.test(val)) {
                countryData.estimatedRevenue = 0;
                countryData.views = parseIntegerValue(val);
                valueIdx = 3;
                logger.debug(
                  `     -> No $ sign: Revenue = 0, Views = ${countryData.views}, move to idx=3`
                );
              }
            } else if (valueIdx === 1 && /%/.test(val)) {
              countryData.revenuePercent = parsePercentValue(val);
              valueIdx = 2;
              logger.debug(
                `     -> RevenuePercent = ${countryData.revenuePercent}, move to idx=2`
              );
            } else if (valueIdx === 2 && /^[\d.,]+$/.test(val)) {
              countryData.views = parseIntegerValue(val);
              valueIdx = 3;
              logger.debug(
                `     -> Views = ${countryData.views}, move to idx=3`
              );
            } else if (valueIdx === 3 && /%/.test(val)) {
              countryData.viewsPercent = parsePercentValue(val);
              valueIdx = 4;
              logger.debug(
                `     -> ViewsPercent = ${countryData.viewsPercent}, move to idx=4`
              );
            } else if (valueIdx === 4 && /^[\d.,]+$/.test(val)) {
              countryData.watchTimeHours = parseDecimalValue(val);
              valueIdx = 5;
              logger.debug(
                `     -> WatchTimeHours = ${countryData.watchTimeHours}, move to idx=5`
              );
            } else if (valueIdx === 5 && /%/.test(val)) {
              countryData.watchTimePercent = parsePercentValue(val);
              valueIdx = 6;
              logger.debug(
                `     -> WatchTimePercent = ${countryData.watchTimePercent}, move to idx=6`
              );
            } else if (
              valueIdx >= 6 &&
              /^\d{1,2}:\d{2}$/.test(val)
            ) {
              countryData.avgWatchTime = val;
              valueIdx = 7;
              logger.debug(
                `     -> AvgWatchTime = ${countryData.avgWatchTime}, move to idx=7`
              );
            } else if (valueIdx === 1 && /^[\d.,]+$/.test(val)) {
              countryData.views = parseIntegerValue(val);
              valueIdx = 3;
              logger.debug(
                `     -> No % after revenue: Views = ${countryData.views}, move to idx=3`
              );
            } else if (
              valueIdx === 2 &&
              /^\d{1,2}:\d{2}$/.test(val)
            ) {
              countryData.avgWatchTime = val;
              valueIdx = 7;
              logger.debug(
                `     -> Direct to time: AvgWatchTime = ${countryData.avgWatchTime}, move to idx=7`
              );
            }
          }

          logger.info(
            `   Final: revenue=${countryData.estimatedRevenue}, views=${countryData.views}, watchTime=${countryData.watchTimeHours}`
          );
          logContent += `  Result: revenue=${countryData.estimatedRevenue}, views=${countryData.views}, watchTime=${countryData.watchTimeHours}\n`;
          if (
            countryData.estimatedRevenue !== null ||
            countryData.views !== null
          ) {
            countries.push(countryData);
          }
        }

        if (
          /Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode/i.test(
            line
          )
        ) {
          break;
        }
      }
    }
  } catch (err) {
    logger.error('Error parsing revenue explore text:', err);
    logContent += `\nERROR: ${err}\n`;
  }

  logContent += `\n\n=== FINAL RESULT ===\n`;
  logContent += `Total Totals: revenue=${totals.estimatedRevenue}, views=${totals.views}, watchTime=${totals.watchTimeHours}\n`;
  logContent += `Countries parsed: ${countries.length}\n`;
  countries.forEach((c, idx) => {
    logContent += `  [${idx}] ${c.country}: revenue=${c.estimatedRevenue}, views=${c.views}\n`;
  });

  if (logPath) {
    try {
      fs.writeFileSync(logPath, logContent, 'utf-8');
    } catch { /* ignore */ }
  }

  return { totals, countries, period };
}

function extractTableRowValues(
  lines: string[],
  startIdx: number,
  maxValues: number
): string[] {
  const values: string[] = [];
  for (
    let i = startIdx;
    i < Math.min(startIdx + maxValues + 5, lines.length);
    i++
  ) {
    const line = lines[i];
    if (
      isCountryName(line) ||
      /^(Tổng|Total|Địa lý|Geography)$/i.test(line)
    )
      break;
    if (
      line === '-' ||
      line === '—' ||
      (/[\d$%:₫]/.test(line) && line.length < 30)
    ) {
      values.push(line);
      logger.debug(`       [extractTableRowValues] Found: "${line}"`);
      if (values.length >= maxValues) break;
    }
  }
  return values;
}

function isCountryName(line: string): boolean {
  if (!line || line.length < 2 || line.length > 50) return false;
  if (/^[\d$%+\-₫]/.test(line)) return false;
  if (/^\d{1,2}:\d{2}$/.test(line)) return false;
  if (
    /^[A-ZÀ-Ỹ][a-zà-ỹ]/.test(line) &&
    !/\$|₫|%|giờ|hour|xem|view|thu|revenue/i.test(line)
  )
    return true;
  return false;
}

function parseRevenueValue(str: string): number | null {
  if (!str || str === '-' || str === '—') return 0;

  if (str.includes('₫')) {
    const vndCleaned = str.replace(/[₫\s]/g, '');
    if (!vndCleaned) return 0;
    const vndAmount = parseNumber(vndCleaned);
    if (isNaN(vndAmount) || vndAmount === 0) return 0;
    const usdAmount = ExchangeRateService.convertVndToUsd(vndAmount);
    if (usdAmount !== null) {
      logger.debug(
        `VND->USD: ${str} (${vndAmount} VND) = ${usdAmount} USD`
      );
    }
    return usdAmount ?? 0;
  }

  const cleaned = str.replace(/[$\s]/g, '');
  if (!cleaned) return 0;
  const num = parseNumber(cleaned);
  return isNaN(num) ? 0 : num;
}

function parsePercentValue(str: string): number | null {
  if (!str) return null;
  const cleaned = str.replace(/%/g, '').trim();
  if (!cleaned) return null;
  const num = parseNumber(cleaned);
  return isNaN(num) ? null : num;
}

function parseIntegerValue(str: string): number | null {
  if (!str) return null;
  const cleaned = normalizeNumber(str);
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseDecimalValue(str: string): number | null {
  if (!str) return null;
  const num = parseNumber(str);
  return num || null;
}

function parseTimeValue(str: string): string | null {
  if (!str) return null;
  const match = str.match(/(\d{1,2}:\d{2})/);
  return match ? match[1] : null;
}

function normalizeNumber(str: string): string {
  let cleaned = str.trim();
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts[1] && parts[1].length > 2)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }
  return cleaned;
}

function parseNumber(str: string): number {
  if (!str) return 0;
  const cleaned = normalizeNumber(str);
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 1000000) / 1000000;
}

// ============================================================
// GEMLOGIN PARALLEL SCRAPE
// ============================================================

/**
 * Parallel scraping optimized for GemLogin.
 */
export async function scrapeMultipleChannelsParallel(
  channelIds: string[],
  month?: string,
  onProgress?: (channelId: string, index: number, total: number) => void,
  adminId?: string,
  batchSize = 3,
  waitMs = 300000,
): Promise<{
  results: YouTubeAnalyticsData[];
  errors: Array<{ channelId: string; error: string }>;
}> {
  const results: YouTubeAnalyticsData[] = [];
  const errors: Array<{ channelId: string; error: string }> = [];
  const total = channelIds.length;

  // JS extraction script
  const EXTRACT_JS = `(function() {
    var SKIP_TAGS = new Set(['SCRIPT','STYLE','SVG','PATH','DEFS','USE']);
    function rowText(el) {
      if (SKIP_TAGS.has(el.tagName)) return '';
      if (el.offsetParent === null) {
        var cs = window.getComputedStyle(el);
        if (cs.display === 'none') return '';
      }
      var parts = [];
      for (var i = 0; i < el.childNodes.length; i++) {
        var child = el.childNodes[i];
        if (child.nodeType === 3) { var t = (child.textContent || '').trim(); if (t) parts.push(t); }
        else if (child.nodeType === 1) { parts.push(rowText(child)); }
      }
      return parts.join(' ');
    }
    var scopes = ['ytd-analytics-multi-dimension-data-table-renderer','ytd-analytics-main-app','#analytics-content-container','main','#page-manager','ytd-app'];
    for (var s = 0; s < scopes.length; s++) {
      var el = document.querySelector(scopes[s]);
      if (el) {
        var rows = el.querySelectorAll('tr,[role="row"]');
        if (rows.length > 3) return Array.from(rows).map(function(r){return rowText(r);}).join('\\n');
      }
    }
    var all = document.querySelectorAll('tr,[role="row"]');
    if (all.length > 3) return Array.from(all).map(function(r){return rowText(r);}).join('\\n');
    return document.body.innerText;
  })()`;

  for (let batchStart = 0; batchStart < total; batchStart += batchSize) {
    const batch = channelIds.slice(batchStart, batchStart + batchSize);
    logger.info(`[Parallel] Batch ${Math.floor(batchStart / batchSize) + 1}: ${batch.length} channels [${batch.join(', ')}]`);

    const context = await getContext(true, adminId);
    const pages: Page[] = [];

    try {
      // Step 1: Open all tabs and navigate in parallel
      logger.info(`[Parallel] Opening ${batch.length} tabs and navigating...`);
      await Promise.all(batch.map(async (channelId, i) => {
        const page = await context.newPage();
        pages[i] = page;

        await page.route('**/*', (route) => {
          const t = route.request().resourceType();
          if (['image', 'font', 'media', 'stylesheet'].includes(t)) return route.abort();
          return route.continue();
        }).catch(() => {});

        const url = buildRevenueExploreUrl(channelId, month);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
          logger.warn(`[Parallel] Navigate ${channelId} error (continuing): ${e.message}`);
        });
        logger.info(`[Parallel] Tab ${i + 1}/${batch.length} loaded: ${channelId}`);
      }));

      await minimizeWindow(adminId);

      // Step 2: Poll until each tab is fully loaded
      const POLL_INTERVAL_MS = 5000;
      const deadlineMs = Date.now() + waitMs;
      const tabReady = new Array(batch.length).fill(false);
      const prevRowCount = new Array(batch.length).fill(0);

      logger.info(`[Parallel] Polling ${batch.length} tabs — waiting for full load (timeout ${Math.round(waitMs / 1000)}s)...`);

      while (tabReady.some((r: boolean) => !r) && Date.now() < deadlineMs) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        await Promise.all(batch.map(async (channelId, i) => {
          if (tabReady[i]) return;
          const page = pages[i];
          if (!page) { tabReady[i] = true; return; }
          try {
            const result = await page.evaluate(() => {
              // Còn spinner → chưa sẵn sàng
              const hasSpinner = !!(
                document.querySelector('ytd-ghost-card-renderer') ||
                document.querySelector('tp-yt-paper-spinner[active]') ||
                document.querySelector('[class*="loading-indicator"][style*="display: block"]') ||
                document.querySelector('ytd-analytics-loading-renderer')
              );
              if (hasSpinner) return { ready: false, reason: 'spinner', len: 0 };

              // Kiểm tra nội dung text thay vì DOM table
              const text = document.body.innerText || '';
              const len = text.length;
              if (len < 500) return { ready: false, reason: `short-text(${len})`, len };

              const hasTotal = /Tổng|Total/i.test(text);
              if (!hasTotal) return { ready: false, reason: 'no-total', len };

              return { ready: true, reason: 'ok', len };
            }) as { ready: boolean; reason: string; len: number };

            if (result.ready) {
              if (result.len === prevRowCount[i] && result.len > 0) {
                tabReady[i] = true;
                logger.info(`[Parallel] OK Tab ${i + 1} (${channelId}) loaded: ${result.len} chars (stable)`);
              } else {
                prevRowCount[i] = result.len;
                logger.info(`[Parallel] Tab ${i + 1} (${channelId}) has ${result.len} chars, waiting to stabilize...`);
              }
            } else {
              prevRowCount[i] = 0;
              logger.info(`[Parallel] Tab ${i + 1} (${channelId}) not ready: ${result.reason}`);
            }
          } catch { /* page still loading */ }
        }));

        const doneCount = (tabReady as boolean[]).filter(Boolean).length;
        if (doneCount < batch.length) {
          const timeLeft = Math.round((deadlineMs - Date.now()) / 1000);
          logger.info(`[Parallel] ${doneCount}/${batch.length} tabs done, ${timeLeft}s remaining...`);
        }
      }

      tabReady.forEach((isReady: boolean, i: number) => {
        if (!isReady) logger.warn(`[Parallel] Tab ${i + 1} (${batch[i]}) timed out — extracting with available data`);
      });

      // Step 3: Extract data from all tabs in parallel
      logger.info(`[Parallel] Extracting data from ${batch.length} tabs...`);
      await Promise.all(batch.map(async (channelId, i) => {
        const page = pages[i];
        if (!page) {
          errors.push({ channelId, error: 'Tab does not exist' });
          return;
        }
        try {
          const currentUrl = page.url();
          if (currentUrl.includes('accounts.google.com')) {
            errors.push({ channelId, error: 'NOT_LOGGED_IN' });
            return;
          }

          await page.evaluate('window.scrollTo(0,400)').catch(() => {});
          await new Promise(r => setTimeout(r, 300));

          const rawText = await page.evaluate(EXTRACT_JS) as string;

          if (!rawText || rawText.trim().length < 50) {
            errors.push({ channelId, error: 'No data (empty page)' });
            return;
          }

          const parsed = parseRevenueExploreText(rawText);
          results.push({
            channelId,
            totals: parsed.totals,
            countries: parsed.countries,
            period: parsed.period,
            rawText,
            scrapedAt: new Date().toISOString(),
          });

          const idx = batchStart + i;
          onProgress?.(channelId, idx, total);
          logger.info(`[Parallel] OK ${channelId}: $${parsed.totals.estimatedRevenue}`);
        } catch (err: any) {
          errors.push({ channelId, error: err.message });
          logger.warn(`[Parallel] FAIL ${channelId}: ${err.message}`);
        }
      }));

    } finally {
      for (const page of pages) {
        await safeClosePage(page);
      }
      logger.info(`[Parallel] Batch done, closed ${pages.length} tabs`);
    }

    // Wait 5s between batches
    if (batchStart + batchSize < total) {
      logger.info('[Parallel] Waiting 5s before next batch...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  logger.info(`[Parallel] Complete: ${results.length} success, ${errors.length} errors`);
  return { results, errors };
}
