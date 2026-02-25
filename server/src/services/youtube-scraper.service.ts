import fs from 'fs';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../middlewares/logger.middleware';
import { ExchangeRateService } from './exchange-rate.service';

// Persistent Chrome profile directory for maintaining login session
const CHROME_USER_DATA_DIR = path.join(process.cwd(), '.chrome-data');
// Cached account info (stored inside the Chrome data dir so it's cleared on session reset)
const ACCOUNT_INFO_FILE = path.join(CHROME_USER_DATA_DIR, 'account-info.json');
// Sentinel file written ONLY after actual YouTube Studio login is verified
const SESSION_VERIFIED_FILE = path.join(CHROME_USER_DATA_DIR, 'session-verified');

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
  /** True while a headful login browser is open — prevents headless operations from interfering */
  private static loginBrowserOpen: boolean = false;
  /** Timestamp when sentinel was last written — used to delay headless extract after fresh login */
  private static sessionVerifiedAt: number = 0;
  /** Flag to prevent multiple auto-close timers from framenavigated firing multiple times */
  private static closeScheduled: boolean = false;

  /**
   * Check if session exists without opening browser
   * @returns true if Chrome profile directory has valid session data
   */
  static hasValidSession(): boolean {
    // Primary check: sentinel file written after confirmed YouTube Studio login
    if (fs.existsSync(SESSION_VERIFIED_FILE)) {
      logger.info('✅ Valid session found (sentinel file present)');
      return true;
    }
    // Fallback check: Chrome profile + Cookies file exists
    if (!fs.existsSync(CHROME_USER_DATA_DIR)) {
      logger.info('❌ No session: Chrome profile directory does not exist');
      return false;
    }
    const defaultProfilePath = path.join(CHROME_USER_DATA_DIR, 'Default');
    if (!fs.existsSync(defaultProfilePath)) {
      logger.info('❌ No session: Default profile not found');
      return false;
    }
    const cookiesPath = path.join(defaultProfilePath, 'Cookies');
    if (!fs.existsSync(cookiesPath)) {
      logger.info('❌ No session: Cookies file not found');
      return false;
    }
    logger.info('✅ Valid session found (Cookies file present)');
    return true;
  }

  /**
   * Write the session-verified sentinel file to mark a confirmed login
   */
  private static markSessionVerified(): void {
    try {
      fs.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });
      fs.writeFileSync(SESSION_VERIFIED_FILE, new Date().toISOString());
      this.sessionVerifiedAt = Date.now();
      logger.info('✅ Session marked as verified.');
    } catch { /* ignore */ }
  }

  /**
   * Get or create a Puppeteer browser with persistent profile
   * @param headless - true (invisible, default) | false (visible, only for manual login)
   * @param attemptNumber - Internal counter for retry logic
   */
  static async getBrowser(headless: boolean = true, attemptNumber: number = 1): Promise<Browser> {
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
        logger.error('❌ Chrome is already running. Attempting to kill process and retry...');
        
        // Try to kill Chrome process
        if (attemptNumber === 1) {
          try {
            const { execSync } = require('child_process');
            const killCmd = process.platform === 'darwin' 
              ? 'pkill -9 -f "Chrome.*chrome-data"'
              : 'pkill -9 -f "chrome.*chrome-data"';
            execSync(killCmd, { stdio: 'ignore' });
            logger.info('🔄 Chrome process killed. Retrying browser launch...');
            
            // Wait a moment for process to fully die
            await new Promise(r => setTimeout(r, 1000));
            
            // Retry once
            return this.getBrowser(headless, 2);
          } catch (killErr) {
            logger.warn(`⚠️ Failed to auto-kill Chrome: ${killErr}`);
          }
        }
        
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
    this.loginBrowserOpen = false;
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
   * Reset session: close browser and delete the saved Chrome profile/session data
   */
  static async resetSession(): Promise<void> {
    await this.closeBrowser();

    if (!fs.existsSync(CHROME_USER_DATA_DIR)) return;

    // Wait for Chrome to fully release file locks before deleting
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let lastError: unknown;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await sleep(attempt * 500); // 500ms, 1s, 1.5s, 2s, 2.5s
        fs.rmSync(CHROME_USER_DATA_DIR, { recursive: true, force: true });
        logger.info('🗑️ Chrome session data deleted.');
        return;
      } catch (err) {
        lastError = err;
        logger.warn(`⚠️ Attempt ${attempt} to delete chrome-data failed, retrying...`);
      }
    }
    throw lastError;
  }

  /**
   * Step 1: Open browser for manual Google login (headful - VISIBLE)
   * User logs in once, session is saved in chrome-data directory
   */
  static async openLoginBrowser(): Promise<{ message: string }> {
    try {
      // Close any existing browser (headless) before opening headful login browser
      await this.closeBrowser();

      this.loginBrowserOpen = true;
      const browser = await this.getBrowser(false); // Explicitly headful for user to login

      // Reset loginBrowserOpen when Chrome is closed by user
      browser.on('disconnected', () => {
        this.loginBrowserOpen = false;
      });

      const page = await browser.newPage();
      await page.goto('https://studio.youtube.com', {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });

      // Monitor navigation: when user completes Google login and lands on YouTube Studio,
      // write the sentinel file so checkLoginStatus() knows login is real
      this.closeScheduled = false;
      page.on('framenavigated', async (frame) => {
        if (frame !== page.mainFrame()) return;
        const url = frame.url();
        if (url.includes('studio.youtube.com') && !url.includes('accounts.google.com')) {
          logger.info('✅ Headful browser navigated to YouTube Studio — login confirmed!');
          this.markSessionVerified();
          this.loginBrowserOpen = false;
          // Guard: only schedule ONE close timer regardless of how many times framenavigated fires
          if (!this.closeScheduled) {
            this.closeScheduled = true;
            // Wait 8s to allow Chrome to fully flush cookies/session to disk before closing
            setTimeout(() => {
              this.closeScheduled = false;
              this.closeBrowser().catch(() => {});
            }, 8000);
          }
        }
      });

      logger.info('🌐 Opened VISIBLE browser for YouTube Studio login. Please log in manually.');
      return { message: 'Browser opened. Please log in to YouTube Studio manually. After login, you can close this and use the scraper.' };
    } catch (error) {
      this.loginBrowserOpen = false;
      logger.error('Failed to open login browser:', error);
      throw error;
    }
  }

  /**
   * Extract account info from YouTube Studio page (headless) and cache to file.
   * Returns { channelName, email } - both may be undefined if extraction fails.
   */
  static async extractAndCacheAccountInfo(): Promise<{ channelName?: string; email?: string }> {
    // Don't run headless operations while headful login browser is open
    if (this.loginBrowserOpen) {
      logger.info('⏭️ Skipping extractAndCacheAccountInfo — login browser is open.');
      return {};
    }
    let page = null;
    try {
      const browser = await this.getBrowser(true);
      page = await browser.newPage();

      // Stealth
      await page.evaluateOnNewDocument(`
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      `);

      await page.goto('https://studio.youtube.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // If redirected to Google login, session is invalid — only remove sentinel, keep chrome-data
      if (page.url().includes('accounts.google.com')) {
        logger.warn('⚠️ Not logged in (redirected to Google login)');
        await safeClosePage(page);
        await this.closeBrowser();
        try {
          if (fs.existsSync(SESSION_VERIFIED_FILE)) {
            fs.unlinkSync(SESSION_VERIFIED_FILE);
            logger.info('🗑️ Sentinel file deleted (session expired).');
          }
        } catch { /* ignore */ }
        return {};
      }

      // Wait a bit for page to render
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Extract channel name from page title: "{Channel Name} - YouTube Studio"
      const title = await page.title();
      const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;

      // Try to get email from account switcher aria-label
      let email: string | undefined;
      try {
        email = await page.evaluate(() => {
          // Try various selectors YouTube uses for the account button
          const selectors = [
            '[aria-label*="@"]',
            '[title*="@"]',
            'yt-img-shadow[aria-label]',
            '#avatar-btn',
            'button[aria-label*="Google"]',
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
              const match = label.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
              if (match) return match[0];
            }
          }
          return null;
        }) as string | null ?? undefined;
      } catch { /* ignore */ }

      logger.info(`✅ Account info extracted: channel="${channelName}" email="${email || 'unknown'}"`);

      // Mark session as verified (headless could access YouTube Studio)
      this.markSessionVerified();

      const info = { channelName, email, extractedAt: new Date().toISOString() };
      try { fs.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify(info, null, 2)); } catch { /* ignore */ }

      await safeClosePage(page);
      return info;
    } catch (err: any) {
      logger.warn('Could not extract account info:', err.message);
      if (page) await safeClosePage(page);
      return {};
    }
  }

  /**
   * Check if user is logged in to YouTube Studio
   */
  static async checkLoginStatus(): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
    // While login browser is open, check sentinel for real-time login detection
    if (this.loginBrowserOpen) {
      if (fs.existsSync(SESSION_VERIFIED_FILE)) {
        // Sentinel was just written by framenavigated — login confirmed
        this.loginBrowserOpen = false;
      } else {
        return { loggedIn: false };
      }
    }

    const hasSession = this.hasValidSession();
    if (!hasSession) return { loggedIn: false };

    // Return cached account info if available
    if (fs.existsSync(ACCOUNT_INFO_FILE)) {
      try {
        const raw = fs.readFileSync(ACCOUNT_INFO_FILE, 'utf-8');
        const info = JSON.parse(raw);
        return { loggedIn: true, channelName: info.channelName, email: info.email };
      } catch { /* ignore */ }
    }

    // No cache yet — extract in background (don't block the response)
    // Wait at least 10s after a fresh login so cookies are fully flushed to disk
    const msSinceVerified = Date.now() - this.sessionVerifiedAt;
    const delayMs = Math.max(0, 10000 - msSinceVerified);
    setTimeout(() => this.extractAndCacheAccountInfo().catch(() => {}), delayMs);
    return { loggedIn: true };
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
  static async scrapeMultipleChannels(
    channelIds: string[],
    month?: string,
    onProgress?: (channelId: string, index: number, total: number) => void
  ): Promise<{
    results: YouTubeAnalyticsData[];
    errors: Array<{ channelId: string; error: string }>;
  }> {
    const results: YouTubeAnalyticsData[] = [];
    const errors: Array<{ channelId: string; error: string }> = [];
    const total = channelIds.length;
    let page: Page | null = null;
    let browser: Browser | null = null;

    try {
      browser = await this.getBrowser(); // Headless mode (invisible)
      page = await browser.newPage();
      logger.info(`📋 Starting batch scrape for ${total} channels (using shared page)${month ? ` for month ${month}` : ''}`);

      for (let i = 0; i < channelIds.length; i++) {
        const channelId = channelIds[i];
        try {
          // Report progress
          if (onProgress) onProgress(channelId, i, total);
          
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
      // Close browser to prevent "Chrome already running" errors
      if (browser) {
        try {
          await browser.close();
          logger.debug('✅ Browser closed after batch scrape');
        } catch (err) {
          logger.warn(`⚠️ Error closing browser: ${err}`);
        }
      }
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
    
    // Create a log file for this parse
    const logPath = path.join(process.cwd(), `parse-revenue-${Date.now()}.log`);
    let logContent = `=== REVENUE PARSING LOG ===\nTime: ${new Date().toISOString()}\n\n`;

    try {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      logContent += `Total lines in text: ${lines.length}\n\n`;

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
          logContent += `\n📊 FOUND TOTAL ROW at line ${i}\n`;
          logContent += `Next lines for extraction:\n`;
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            logContent += `  [${j}]: "${lines[j]}"\n`;
          }
          // Next values should be: revenue, views, watch_time, avg_watch_time
          const rowValues = this.extractTableRowValues(lines, i + 1, 4);
          logContent += `\nExtracted values: [${rowValues.map(v => `"${v}"`).join(', ')}] (count: ${rowValues.length})\n`;
          logger.info(`📊 TOTAL ROW - Raw values: [${rowValues.join(', ')}]`);
          if (rowValues.length >= 1) {
            const revParsed = this.parseRevenueValue(rowValues[0]);
            totals.estimatedRevenue = revParsed;
            logContent += `  [0] "${rowValues[0]}" → Revenue = ${revParsed}\n`;
            logger.info(`   [Total] Revenue field: "${rowValues[0]}" → ${totals.estimatedRevenue}`);
          }
          if (rowValues.length >= 2) {
            const viewsParsed = this.parseIntegerValue(rowValues[1]);
            totals.views = viewsParsed;
            logContent += `  [1] "${rowValues[1]}" → Views = ${viewsParsed}\n`;
            logger.info(`   [Total] Views field: "${rowValues[1]}" → ${totals.views}`);
          }
          if (rowValues.length >= 3) {
            const wtParsed = this.parseDecimalValue(rowValues[2]);
            totals.watchTimeHours = wtParsed;
            logContent += `  [2] "${rowValues[2]}" → WatchTime = ${wtParsed}\n`;
            logger.info(`   [Total] WatchTime field: "${rowValues[2]}" → ${totals.watchTimeHours}`);
          }
          if (rowValues.length >= 4) {
            totals.avgWatchTime = this.parseTimeValue(rowValues[3]);
            logContent += `  [3] "${rowValues[3]}" → AvgTime = ${totals.avgWatchTime}\n`;
          }
          logContent += `\nFinal totals: revenue=${totals.estimatedRevenue}, views=${totals.views}, watchTime=${totals.watchTimeHours}\n`;
          logger.info(`   [Total] Final: revenue=${totals.estimatedRevenue}, views=${totals.views}`);
          continue;
        }

        // Parse country rows (after Tổng)
        if (foundTotal) {
          // Country names are non-numeric text that isn't a header or navigation element
          // Skip known non-country lines
          if (this.isCountryName(line)) {
            const country = line;
            const rowValues = this.extractTableRowValues(lines, i + 1, 8);
            logContent += `\n🌍 Country: ${country}\n`;
            logContent += `  Raw values: [${rowValues.map(v => `"${v}"`).join(', ')}]\n`;
            logger.info(`🌍 Parsing country: ${country}`);
            logger.info(`   Raw values: [${rowValues.join(', ')}]`);
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
              logger.debug(`   [v=${v}, idx=${valueIdx}] Processing: "${val}"`);
              
              if (valueIdx === 0) {
                // Revenue field: check for $ or dash
                if (val === '-') {
                  countryData.estimatedRevenue = 0; // No earnings = 0
                  valueIdx = 2; // Skip revenue percent field, next should be views
                  logger.debug(`     → Revenue = 0 (dash), skip to idx=2`);
                } else if (/\$/.test(val)) {
                  countryData.estimatedRevenue = this.parseRevenueValue(val);
                  valueIdx = 1;
                  logger.debug(`     → Revenue = ${countryData.estimatedRevenue}, move to idx=1`);
                } else if (/^[\d.,]+$/.test(val)) {
                  // No $ sign - this is likely views (no revenue row)
                  countryData.estimatedRevenue = 0;
                  countryData.views = this.parseIntegerValue(val);
                  valueIdx = 3;
                  logger.debug(`     → No $ sign: Revenue = 0, Views = ${countryData.views}, move to idx=3`);
                }
              } else if (valueIdx === 1 && /%/.test(val)) {
                countryData.revenuePercent = this.parsePercentValue(val);
                valueIdx = 2;
                logger.debug(`     → RevenuePercent = ${countryData.revenuePercent}, move to idx=2`);
              } else if (valueIdx === 2 && /^[\d.,]+$/.test(val)) {
                countryData.views = this.parseIntegerValue(val);
                valueIdx = 3;
                logger.debug(`     → Views = ${countryData.views}, move to idx=3`);
              } else if (valueIdx === 3 && /%/.test(val)) {
                countryData.viewsPercent = this.parsePercentValue(val);
                valueIdx = 4;
                logger.debug(`     → ViewsPercent = ${countryData.viewsPercent}, move to idx=4`);
              } else if (valueIdx === 4 && /^[\d.,]+$/.test(val)) {
                countryData.watchTimeHours = this.parseDecimalValue(val);
                valueIdx = 5;
                logger.debug(`     → WatchTimeHours = ${countryData.watchTimeHours}, move to idx=5`);
              } else if (valueIdx === 5 && /%/.test(val)) {
                countryData.watchTimePercent = this.parsePercentValue(val);
                valueIdx = 6;
                logger.debug(`     → WatchTimePercent = ${countryData.watchTimePercent}, move to idx=6`);
              } else if (valueIdx >= 6 && /^\d{1,2}:\d{2}$/.test(val)) {
                countryData.avgWatchTime = val;
                valueIdx = 7;
                logger.debug(`     → AvgWatchTime = ${countryData.avgWatchTime}, move to idx=7`);
              } else if (valueIdx === 1 && /^[\d.,]+$/.test(val)) {
                // No percent after revenue - move to views
                countryData.views = this.parseIntegerValue(val);
                valueIdx = 3;
                logger.debug(`     → No % after revenue: Views = ${countryData.views}, move to idx=3`);
              } else if (valueIdx === 2 && /^\d{1,2}:\d{2}$/.test(val)) {
                // Direct to avg watch time
                countryData.avgWatchTime = val;
                valueIdx = 7;
                logger.debug(`     → Direct to time: AvgWatchTime = ${countryData.avgWatchTime}, move to idx=7`);
              }
            }

            logger.info(`   Final: revenue=${countryData.estimatedRevenue}, views=${countryData.views}, watchTime=${countryData.watchTimeHours}`);
            logContent += `  Result: revenue=${countryData.estimatedRevenue}, views=${countryData.views}, watchTime=${countryData.watchTimeHours}\n`;
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
      logContent += `\nERROR: ${err}\n`;
    }

    // Save final results to log file
    logContent += `\n\n=== FINAL RESULT ===\n`;
    logContent += `Total Totals: revenue=${totals.estimatedRevenue}, views=${totals.views}, watchTime=${totals.watchTimeHours}\n`;
    logContent += `Countries parsed: ${countries.length}\n`;
    countries.forEach((c, idx) => {
      logContent += `  [${idx}] ${c.country}: revenue=${c.estimatedRevenue}, views=${c.views}\n`;
    });
    
    try {
      fs.writeFileSync(logPath, logContent, 'utf-8');
      logger.info(`✅ Parsing log saved to: ${logPath}`);
    } catch (err) {
      logger.error(`Failed to write parsing log: ${err}`);
    }

    return { totals, countries, period };
  }

  /**
   * Extract N values from lines starting at startIdx, skipping non-value lines
   * Include "-" (empty/no earnings indicator) as valid value
   */
  private static extractTableRowValues(lines: string[], startIdx: number, maxValues: number): string[] {
    const values: string[] = [];
    for (let i = startIdx; i < Math.min(startIdx + maxValues + 5, lines.length); i++) {
      const line = lines[i];
      // Stop if we hit a country name or section header
      if (this.isCountryName(line) || /^(Tổng|Total|Địa lý|Geography)$/i.test(line)) break;
      // Value patterns: "16,89 $", "881.685", "5.578,5", "0:46", "93,7%", "-", "—" (em dash, no earnings)
      // Match: digits/dots/commas, $, %, :, or dash variants (-, —)
      if (line === '-' || line === '—' || (/[\d$%:]/.test(line) && line.length < 30)) {
        values.push(line);
        logger.debug(`       [extractTableRowValues] Found: "${line}"`);
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
   * Parse revenue value like "16,89 $" or "$16.89" or "0,001 $" or "-" (no earnings)
   */
  private static parseRevenueValue(str: string): number | null {
    // Handle dash variants (-, —) = no earnings → return 0 to display on charts
    if (!str || str === '-' || str === '—') return 0;

    // Handle VND currency (₫)
    if (str.includes('₫')) {
      const vndCleaned = str.replace(/[₫\s]/g, '');
      if (!vndCleaned) return 0;
      const vndAmount = this.parseNumber(vndCleaned);
      if (isNaN(vndAmount) || vndAmount === 0) return 0;
      const usdAmount = ExchangeRateService.convertVndToUsd(vndAmount);
      if (usdAmount !== null) {
        logger.debug(`📊 VND→USD: ${str} (${vndAmount} ₫) = ${usdAmount} $`);
      }
      return usdAmount ?? 0;
    }

    // Handle USD currency ($)
    const cleaned = str.replace(/[$\s]/g, '');
    if (!cleaned) return 0;
    const num = this.parseNumber(cleaned);
    return isNaN(num) ? 0 : num;
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
