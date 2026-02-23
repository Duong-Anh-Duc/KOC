import fs from 'fs';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../middlewares/logger.middleware';

// Persistent Chrome profile directory for maintaining login session
const CHROME_USER_DATA_DIR = path.join(process.cwd(), '.chrome-data');

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
  /** Period label (e.g. "Tháng 1") */
  period: string;
  /** Raw page text for debugging */
  rawText?: string;
  scrapedAt: string;
}

/**
 * Safely close a Puppeteer page, ignoring ProtocolError if target is already gone
 */
async function safeClosePage(page: Page | null): Promise<void> {
  if (!page) return;
  try {
    await page.close();
  } catch (err: any) {
    // Ignore "No target with given id found" — page already closed/navigated away
    if (!err.message?.includes('No target with given id')) {
      logger.warn('Error closing page (ignored):', err.message);
    }
  }
}

export class YouTubeScraperService {
  private static browser: Browser | null = null;

  /**
   * Check if session exists without opening browser
   * @returns true if Chrome profile directory has valid session data
   */
  static hasValidSession(): boolean {
    // Check if .chrome-data directory exists
    if (!fs.existsSync(CHROME_USER_DATA_DIR)) {
      logger.info('❌ No session: Chrome profile directory does not exist');
      return false;
    }

    // Check if Default profile exists (where cookies are stored)
    const defaultProfilePath = path.join(CHROME_USER_DATA_DIR, 'Default');
    if (!fs.existsSync(defaultProfilePath)) {
      logger.info('❌ No session: Default profile not found');
      return false;
    }

    // Check if cookies file exists
    const cookiesPath = path.join(defaultProfilePath, 'Cookies');
    if (!fs.existsSync(cookiesPath)) {
      logger.info('❌ No session: Cookies file not found');
      return false;
    }

    logger.info('✅ Valid session found: Ready to scrape without opening browser');
    return true;
  }

  /**
   * Get or create a Puppeteer browser with persistent profile
   * @param headless - true (invisible, default) | false (visible, only for manual login)
   */
  static async getBrowser(headless: boolean = true): Promise<Browser> {
    // If browser exists and connected, reuse it
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    // If browser exists but disconnected, clean up first
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore close errors
      }
      this.browser = null;
    }

    try {
      this.browser = await puppeteer.launch({
        headless,
        userDataDir: CHROME_USER_DATA_DIR,
        timeout: 120000, // 2 minutes to launch browser
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--window-size=1400,900',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        ],
        defaultViewport: { width: 1400, height: 900 },
      });

      // Auto-cleanup on disconnect
      this.browser.on('disconnected', () => {
        this.browser = null;
      });

      return this.browser;
    } catch (error: any) {
      // If launch failed due to existing Chrome instance, provide helpful message
      if (error.message?.includes('already running')) {
        logger.error('❌ Chrome is already running. Kill the process manually:');
        logger.error('   macOS: pkill -f "Chrome.*chrome-data"');
        logger.error('   Linux: pkill -f "chrome.*chrome-data"');
        throw new Error('Chrome browser is already running. Please close it first or restart your system.');
      }
      throw error;
    }
  }

  /**
   * Close the browser instance
   */
  static async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // ignore
      }
      this.browser = null;
    }
  }

  /**
   * Step 1: Open browser for manual Google login (headful - VISIBLE)
   * User logs in once, session is saved in chrome-data directory
   */
  static async openLoginBrowser(): Promise<{ message: string }> {
    try {
      const browser = await this.getBrowser(false); // Explicitly headful for user to login
      const page = await browser.newPage();
      await page.goto('https://studio.youtube.com', {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });
      logger.info('🌐 Opened VISIBLE browser for YouTube Studio login. Please log in manually.');
      return { message: 'Browser opened. Please log in to YouTube Studio manually. After login, you can close this and use the scraper.' };
    } catch (error) {
      logger.error('Failed to open login browser:', error);
      throw error;
    }
  }

  /**
   * Check if user is logged in to YouTube Studio
   */
  static async checkLoginStatus(): Promise<{ loggedIn: boolean; email?: string }> {
    // Just check if session exists - no browser opened
    const hasSession = this.hasValidSession();
    if (hasSession) {
      return { loggedIn: true, email: 'Session found (email not available)' };
    }
    return { loggedIn: false };
  }

  /**
   * Extract a clean YouTube channel ID (strip query params, whitespace, URL parts)
   */
  static cleanChannelId(raw: string): string {
    let id = raw.trim();
    // Strip query string (?c=... etc)
    const qIdx = id.indexOf('?');
    if (qIdx !== -1) id = id.substring(0, qIdx);
    // Strip fragment
    const hIdx = id.indexOf('#');
    if (hIdx !== -1) id = id.substring(0, hIdx);
    // If it's a full URL, extract the channel ID
    const urlMatch = id.match(/(?:youtube\.com\/channel\/|studio\.youtube\.com\/channel\/)([A-Za-z0-9_-]+)/);
    if (urlMatch) id = urlMatch[1];
    return id.trim();
  }

  /**
   * Build the revenue explore URL for a channel
   * @param channelId - YouTube channel ID
   * @param month - Optional month in "MM/YYYY" format. If omitted, uses previous month.
   */
  private static buildRevenueExploreUrl(channelId: string, month?: string): string {
    const cleanId = this.cleanChannelId(channelId);
    let timePeriodParam = 'time_period=minus_1_month';

    if (month) {
      // Convert "01/2026" → start_date=2026-01-01&end_date=2026-01-31
      const [mm, yyyy] = month.split('/');
      const year = parseInt(yyyy, 10);
      const mon = parseInt(mm, 10);
      const startDate = `${yyyy}-${mm}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const endDate = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
      timePeriodParam = `time_period=custom&start_date=${startDate}&end_date=${endDate}`;
    }

    return `https://studio.youtube.com/channel/${cleanId}/analytics/tab-earn_revenue/period-default/explore?entity_type=CHANNEL&entity_id=${cleanId}&${timePeriodParam}&explore_type=TABLE_AND_CHART&metric=TOTAL_ESTIMATED_EARNINGS&granularity=DAY&t_metrics=TOTAL_ESTIMATED_EARNINGS&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=AVERAGE_WATCH_TIME&dimension=COUNTRY&o_column=TOTAL_ESTIMATED_EARNINGS&o_direction=ANALYTICS_ORDER_DIRECTION_DESC`;
  }

  /**
   * Navigate to revenue explore page and extract page text
   * @param month - Optional month in "MM/YYYY" format
   */
  private static async scrapeRevenueExplore(page: Page, channelId: string, month?: string): Promise<string> {
    const url = this.buildRevenueExploreUrl(channelId, month);
    logger.info(`📊 Scraping revenue explore for channel: ${channelId}${month ? ` (month: ${month})` : ''}`);
    
    // Apply stealth techniques before navigation
    await page.evaluateOnNewDocument(`
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    `);
    
    try {
      logger.info(`⏳ Navigating to revenue explore page...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
      logger.info(`✓ Page loaded`);
    } catch (err: any) {
      logger.warn(`⚠️ Page load timeout/error, continuing anyway...`, err.message);
    }

    // Check if redirected to login
    if (page.url().includes('accounts.google.com')) {
      throw new Error('NOT_LOGGED_IN');
    }

    logger.info(`⏳ Waiting for analytics to render...`);
    await this.waitForAnalytics(page);
    logger.info(`✓ Analytics loaded`);

    logger.info(`⏳ Extracting text...`);
    const text = await Promise.race([
      page.evaluate('document.body.innerText') as Promise<string>,
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout extracting text (exceeded 120s)')), 120000)
      ),
    ]);

    logger.info(`✓ Scraped revenue explore (${text.length} chars)`);
    return text;
  }

  /**
   * Step 2: Scrape YouTube Studio revenue explore page for a channel
   * @param month - Optional month in "MM/YYYY" format
   */
  static async scrapeAnalytics(channelId: string, month?: string): Promise<YouTubeAnalyticsData> {
    let page: Page | null = null;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      logger.info(`🚀 Starting scrape for channel: ${channelId}${month ? ` (month: ${month})` : ''}`);
      
      const result = await this.scrapeChannelWithPage(page, channelId, month);
      return result;
    } finally {
      await safeClosePage(page);
    }
  }

  /**
   * Scrape multiple channels sequentially - REUSES same page for efficiency
   * Max time: ~10 minutes per channel
   * @param month - Optional month in "MM/YYYY" format
   */
  static async scrapeMultipleChannels(channelIds: string[], month?: string): Promise<{
    results: YouTubeAnalyticsData[];
    errors: Array<{ channelId: string; error: string }>;
  }> {
    const results: YouTubeAnalyticsData[] = [];
    const errors: Array<{ channelId: string; error: string }> = [];
    const total = channelIds.length;
    let page: Page | null = null;

    try {
      const browser = await this.getBrowser(); // Headless mode (invisible)
      page = await browser.newPage();
      logger.info(`📋 Starting batch scrape for ${total} channels (using shared page)${month ? ` for month ${month}` : ''}`);


      for (let i = 0; i < channelIds.length; i++) {
        const channelId = channelIds[i];
        try {
          logger.info(`[${i + 1}/${total}] Processing channel: ${channelId}`);
          const data = await this.scrapeChannelWithPage(page, channelId, month);
          results.push(data);
          logger.info(`[${i + 1}/${total}] ✅ Success`);
          // Small delay between channels to avoid rate limiting
          await new Promise(r => setTimeout(r, 2000));
        } catch (error: any) {
          logger.warn(`[${i + 1}/${total}] ❌ Failed: ${error.message}`);
          errors.push({ channelId, error: error.message });
          if (error.message === 'NOT_LOGGED_IN') {
            logger.error('Login session expired. Stopping batch scrape.');
            break;
          }
          // Continue with next channel on timeout or other errors
        }
      }

      logger.info(`📊 Batch complete: ${results.length} success, ${errors.length} failed`);
      return { results, errors };
    } finally {
      await safeClosePage(page);
    }
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Core scraping logic - uses provided page (reusable for batch operations)
   * @param month - Optional month in "MM/YYYY" format
   */
  private static async scrapeChannelWithPage(page: Page, channelId: string, month?: string): Promise<YouTubeAnalyticsData> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('SCRAPE_TIMEOUT: Exceeded 5 minutes')), 300000);
    });

    const scrapePromise = (async () => {
      try {
        const rawText = await this.scrapeRevenueExplore(page, channelId, month);
        const parsed = this.parseRevenueExploreText(rawText);

        const result: YouTubeAnalyticsData = {
          channelId,
          totals: parsed.totals,
          countries: parsed.countries,
          period: parsed.period,
          rawText,
          scrapedAt: new Date().toISOString(),
        };

        logger.info(`✅ Successfully scraped revenue explore for channel: ${channelId}`, {
          revenue: parsed.totals.estimatedRevenue,
          views: parsed.totals.views,
          countries: parsed.countries.length,
        });

        return result;
      } catch (error: any) {
        if (error.message === 'NOT_LOGGED_IN') {
          logger.warn('Not logged in to YouTube Studio');
          throw new Error('NOT_LOGGED_IN');
        }
        if (error.message?.includes('SCRAPE_TIMEOUT')) {
          logger.error(`⏱️ Timeout scraping ${channelId}`);
          throw new Error('SCRAPE_TIMEOUT');
        }
        logger.error(`Failed to scrape analytics for ${channelId}:`, error);
        throw error;
      }
    })();

    return Promise.race([scrapePromise, timeoutPromise]);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Wait for YouTube Studio analytics page to fully render
   */
  private static async waitForAnalytics(page: Page): Promise<void> {
    logger.info(`⏳ Waiting for page to render (5s)...`);
    await new Promise(r => setTimeout(r, 5000));
  }

  /**
   * Parse the revenue explore page text.
   * Expected table format (Vietnamese):
   *   Địa lý | Doanh thu ước tính | Số lượt xem | Thời gian xem (giờ) | Thời lượng xem trung bình
   *   Tổng   | 16,89 $            | 881.685     | 5.578,5             | 0:46
   *   Việt Nam | 15,83 $ 93,7%    | 871.898 98,9% | 5.510,5 98,8%    | 0:46
   */
  private static parseRevenueExploreText(text: string): {
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

    try {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Extract period from text (e.g. "1 – 31 thg 1, 2026" or "Tháng 1")
      for (const line of lines) {
        const periodMatch = line.match(/(\d+\s*[–-]\s*\d+\s*thg\s*\d+,?\s*\d{4})/i);
        if (periodMatch) {
          period = periodMatch[1];
          break;
        }
        const monthMatch = line.match(/^Tháng\s+\d+$/i);
        if (monthMatch) {
          period = line;
        }
      }

      // Find the "Tổng" (Total) row - this is our anchor
      // The table has columns: Địa lý, Doanh thu ước tính ↓, Số lượt xem, Thời gian xem (giờ), Thời lượng xem trung bình
      // We need to find "Tổng" or "Total" and then parse the row data
      
      let inTable = false;
      let foundTotal = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect table header area
        if (/^Địa lý$|^Geography$/i.test(line) || /Doanh thu ước tính|Estimated revenue/i.test(line)) {
          inTable = true;
          continue;
        }

        if (!inTable) continue;

        // Parse "Tổng" (Total) row
        if (/^Tổng$|^Total$/i.test(line) && !foundTotal) {
          foundTotal = true;
          // Next values should be: revenue, views, watch_time, avg_watch_time
          const rowValues = this.extractTableRowValues(lines, i + 1, 4);
          if (rowValues.length >= 1) totals.estimatedRevenue = this.parseRevenueValue(rowValues[0]);
          if (rowValues.length >= 2) totals.views = this.parseIntegerValue(rowValues[1]);
          if (rowValues.length >= 3) totals.watchTimeHours = this.parseDecimalValue(rowValues[2]);
          if (rowValues.length >= 4) totals.avgWatchTime = this.parseTimeValue(rowValues[3]);
          continue;
        }

        // Parse country rows (after Tổng)
        if (foundTotal) {
          // Country names are non-numeric text that isn't a header or navigation element
          // Skip known non-country lines
          if (this.isCountryName(line)) {
            const country = line;
            const rowValues = this.extractTableRowValues(lines, i + 1, 8);
            // Row format: "15,83 $" "93,7%" "871.898" "98,9%" "5.510,5" "98,8%" "0:46"
            // Or without percentages depending on layout
            
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

            // Parse the values - they alternate between value and percent
            let valueIdx = 0;
            for (let v = 0; v < rowValues.length && valueIdx < 7; v++) {
              const val = rowValues[v];
              
              if (valueIdx === 0 && /\$/.test(val)) {
                countryData.estimatedRevenue = this.parseRevenueValue(val);
                valueIdx = 1;
              } else if (valueIdx === 1 && /%/.test(val)) {
                countryData.revenuePercent = this.parsePercentValue(val);
                valueIdx = 2;
              } else if (valueIdx === 2 && /^[\d.,]+$/.test(val)) {
                countryData.views = this.parseIntegerValue(val);
                valueIdx = 3;
              } else if (valueIdx === 3 && /%/.test(val)) {
                countryData.viewsPercent = this.parsePercentValue(val);
                valueIdx = 4;
              } else if (valueIdx === 4 && /^[\d.,]+$/.test(val)) {
                countryData.watchTimeHours = this.parseDecimalValue(val);
                valueIdx = 5;
              } else if (valueIdx === 5 && /%/.test(val)) {
                countryData.watchTimePercent = this.parsePercentValue(val);
                valueIdx = 6;
              } else if (valueIdx >= 6 && /^\d{1,2}:\d{2}$/.test(val)) {
                countryData.avgWatchTime = val;
                valueIdx = 7;
              } else if (valueIdx === 1 && /^[\d.,]+$/.test(val)) {
                // No percent after revenue - move to views
                countryData.views = this.parseIntegerValue(val);
                valueIdx = 3;
              } else if (valueIdx === 2 && /^\d{1,2}:\d{2}$/.test(val)) {
                // Direct to avg watch time
                countryData.avgWatchTime = val;
                valueIdx = 7;
              }
            }

            if (countryData.estimatedRevenue !== null || countryData.views !== null) {
              countries.push(countryData);
            }
          }

          // Stop if we hit something that's clearly not a table row
          if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode/i.test(line)) {
            break;
          }
        }
      }
    } catch (err) {
      logger.error('Error parsing revenue explore text:', err);
    }

    return { totals, countries, period };
  }

  /**
   * Extract N values from lines starting at startIdx, skipping non-value lines
   */
  private static extractTableRowValues(lines: string[], startIdx: number, maxValues: number): string[] {
    const values: string[] = [];
    for (let i = startIdx; i < Math.min(startIdx + maxValues + 5, lines.length); i++) {
      const line = lines[i];
      // Stop if we hit a country name or section header
      if (this.isCountryName(line) || /^(Tổng|Total|Địa lý|Geography)$/i.test(line)) break;
      // Value patterns: "16,89 $", "881.685", "5.578,5", "0:46", "93,7%"
      if (/[\d$%:]/.test(line) && line.length < 30) {
        values.push(line);
        if (values.length >= maxValues) break;
      }
    }
    return values;
  }

  /**
   * Check if a line looks like a country name
   */
  private static isCountryName(line: string): boolean {
    if (!line || line.length < 2 || line.length > 50) return false;
    // Must start with uppercase letter, not be a number/percentage/currency
    if (/^[\d$%+\-]/.test(line)) return false;
    if (/^\d{1,2}:\d{2}$/.test(line)) return false;
    // Known country names pattern (Vietnamese and English)
    if (/^[A-ZÀ-Ỹ][a-zà-ỹ]/.test(line) && !/\$|%|giờ|hour|xem|view|thu|revenue/i.test(line)) return true;
    return false;
  }

  /**
   * Parse revenue value like "16,89 $" or "$16.89" or "0,001 $"
   */
  private static parseRevenueValue(str: string): number | null {
    if (!str) return null;
    const cleaned = str.replace(/[$\s]/g, '');
    if (!cleaned) return null;
    const num = this.parseNumber(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse percentage like "93,7%" or "93.7%" or "0,0%"
   */
  private static parsePercentValue(str: string): number | null {
    if (!str) return null;
    const cleaned = str.replace(/%/g, '').trim();
    if (!cleaned) return null;
    const num = this.parseNumber(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse integer value like "881.685" (European format: period = thousand sep)
   */
  private static parseIntegerValue(str: string): number | null {
    if (!str) return null;
    const cleaned = this.normalizeNumber(str);
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse decimal value like "5.578,5" (Vietnamese: period=thousand, comma=decimal)
   */
  private static parseDecimalValue(str: string): number | null {
    if (!str) return null;
    const num = this.parseNumber(str);
    return num || null;
  }

  /**
   * Parse time value like "0:46"
   */
  private static parseTimeValue(str: string): string | null {
    if (!str) return null;
    const match = str.match(/(\d{1,2}:\d{2})/);
    return match ? match[1] : null;
  }

  /**
   * Normalize number string to standard format
   * YouTube Studio uses European format: comma = decimal, period = thousand separator
   * Examples: "0,005" → 0.005, "16,89" → 16.89, "1.234,56" → 1234.56, "881.685" → 881685
   */
  private static normalizeNumber(str: string): string {
    let cleaned = str.trim();
    
    // European format detection: If comma exists, it's ALWAYS the decimal separator
    // Period is ALWAYS the thousand separator
    if (cleaned.includes(',')) {
      // Remove periods (thousand separators), then replace comma with decimal point
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes('.')) {
      // No comma but has periods - depends on context
      // If multiple periods OR period not near the end, treat as thousand separator
      const parts = cleaned.split('.');
      if (parts.length > 2 || (parts[1] && parts[1].length > 2)) {
        // Multiple periods or last segment > 2 digits = thousand separators
        cleaned = cleaned.replace(/\./g, '');
      }
      // Otherwise leave it as decimal point (e.g. "5.00")
    }
    
    return cleaned;
  }

  /**
   * Parse a number in Vietnamese/English format
   * "9,33" → 9.33, "171,93" → 171.93, "1.234,56" → 1234.56, "0,005" → 0.005
   */
  private static parseNumber(str: string): number {
    if (!str) return 0;
    const cleaned = this.normalizeNumber(str);
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 1000000) / 1000000;
  }
}
