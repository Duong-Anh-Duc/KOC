import fs from 'fs';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../middlewares/logger.middleware';
import { ExchangeRateService } from './exchange-rate.service';

// Base directory for Chrome profiles - each admin gets their own sub-directory
const CHROME_DATA_BASE_DIR = path.join(process.cwd(), '.chrome-data');

/** Get per-admin Chrome profile directory */
function getChromeUserDataDir(adminId?: string): string {
  if (adminId) {
    return path.join(CHROME_DATA_BASE_DIR, adminId);
  }
  return CHROME_DATA_BASE_DIR;
}

/** Get per-admin account info file */
function getAccountInfoFile(adminId?: string): string {
  return path.join(getChromeUserDataDir(adminId), 'account-info.json');
}

/** Get per-admin session verified sentinel file */
function getSessionVerifiedFile(adminId?: string): string {
  return path.join(getChromeUserDataDir(adminId), 'session-verified');
}

/** Get per-admin cookies JSON file */
function getCookieFile(adminId?: string): string {
  return path.join(getChromeUserDataDir(adminId), 'cookies.json');
}

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
  /** Per-admin browser instances: adminId → Browser */
  private static browsers: Map<string, Browser> = new Map();
  /** Legacy single browser for backward compat */
  private static browser: Browser | null = null;
  /** Per-admin login browser open flags */
  private static loginBrowserOpenMap: Map<string, boolean> = new Map();
  /** True while a headful login browser is open — prevents headless operations from interfering */
  private static loginBrowserOpen: boolean = false;
  /** Timestamp when sentinel was last written — used to delay headless extract after fresh login */
  private static sessionVerifiedAt: number = 0;
  /** Per-admin session verified timestamps */
  private static sessionVerifiedAtMap: Map<string, number> = new Map();
  /** Flag to prevent multiple auto-close timers from framenavigated firing multiple times */
  private static closeScheduled: boolean = false;

  /**
   * Check if session exists without opening browser
   * @param adminId - Optional admin ID for per-admin session check
   * @returns true if Chrome profile directory has valid session data
   */
  static hasValidSession(adminId?: string): boolean {
    const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);
    const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);

    // Primary check: sentinel file written after confirmed YouTube Studio login
    if (fs.existsSync(SESSION_VERIFIED_FILE)) {
      logger.info(`✅ Valid session found for admin ${adminId || 'default'} (sentinel file present)`);
      return true;
    }
    // Fallback check: Chrome profile + Cookies file exists
    if (!fs.existsSync(CHROME_USER_DATA_DIR)) {
      logger.info(`❌ No session for admin ${adminId || 'default'}: Chrome profile directory does not exist`);
      return false;
    }
    const defaultProfilePath = path.join(CHROME_USER_DATA_DIR, 'Default');
    if (!fs.existsSync(defaultProfilePath)) {
      logger.info(`❌ No session for admin ${adminId || 'default'}: Default profile not found`);
      return false;
    }
    const cookiesPath = path.join(defaultProfilePath, 'Cookies');
    if (!fs.existsSync(cookiesPath)) {
      logger.info(`❌ No session for admin ${adminId || 'default'}: Cookies file not found`);
      return false;
    }
    logger.info(`✅ Valid session found for admin ${adminId || 'default'} (Cookies file present)`);
    return true;
  }

  /**
   * Save all browser cookies to a JSON file via CDP (Chrome DevTools Protocol).
   * This captures ALL cookies including httpOnly/secure ones that Chrome's profile
   * storage may encrypt with a keyring unavailable in Docker.
   */
  private static async saveCookiesViaCDP(browser: Browser, adminId?: string): Promise<void> {
    try {
      const pages = await browser.pages();
      const page = pages[0] || await browser.newPage();
      const client = await page.createCDPSession();
      const { cookies } = await client.send('Network.getAllCookies');
      const cookieFile = getCookieFile(adminId);
      const dir = getChromeUserDataDir(adminId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
      logger.info(`🍪 Saved ${cookies.length} cookies to ${cookieFile}`);
      await client.detach();
    } catch (err: any) {
      logger.warn(`⚠️ Failed to save cookies: ${err.message}`);
    }
  }

  /**
   * Load cookies from JSON file into a browser page via CDP.
   * Used when launching a fresh browser to restore a previous login session.
   */
  private static async loadCookiesViaCDP(browser: Browser, adminId?: string): Promise<boolean> {
    const cookieFile = getCookieFile(adminId);
    if (!fs.existsSync(cookieFile)) {
      logger.info(`🍪 No saved cookies file found for admin ${adminId || 'default'}`);
      return false;
    }
    try {
      const raw = fs.readFileSync(cookieFile, 'utf8');
      const cookies = JSON.parse(raw);
      if (!Array.isArray(cookies) || cookies.length === 0) return false;
      const pages = await browser.pages();
      const page = pages[0] || await browser.newPage();
      const client = await page.createCDPSession();
      await client.send('Network.setCookies', { cookies });
      logger.info(`🍪 Loaded ${cookies.length} cookies from file for admin ${adminId || 'default'}`);
      await client.detach();
      return true;
    } catch (err: any) {
      logger.warn(`⚠️ Failed to load cookies: ${err.message}`);
      return false;
    }
  }

  /**
   * Write the session-verified sentinel file to mark a confirmed login
   */
  private static markSessionVerified(adminId?: string): void {
    try {
      const dir = getChromeUserDataDir(adminId);
      const file = getSessionVerifiedFile(adminId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, new Date().toISOString());
      this.sessionVerifiedAt = Date.now();
      if (adminId) this.sessionVerifiedAtMap.set(adminId, Date.now());
      logger.info(`✅ Session marked as verified for admin ${adminId || 'default'}.`);
    } catch { /* ignore */ }
  }

  /**
   * Get or create a Puppeteer browser with persistent profile
   * @param headless - true (invisible, default) | false (visible, only for manual login)
   * @param attemptNumber - Internal counter for retry logic
   * @param adminId - Optional admin ID for per-admin Chrome profile
   */
  /**
   * Remove stale Chrome lock files (SingletonLock, SingletonCookie, SingletonSocket)
   * These get left behind if Chrome crashes or was copied from another machine.
   * NOTE: These are often symlinks, and broken symlinks are invisible to fs.existsSync(),
   * so we must use fs.lstatSync() which detects the link itself.
   */
  private static cleanStaleLockFiles(userDataDir: string): void {
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    for (const file of lockFiles) {
      const filePath = path.join(userDataDir, file);
      try {
        // Use lstat (not stat/existsSync) because these are symlinks — 
        // if the symlink target doesn't exist, existsSync returns false!
        fs.lstatSync(filePath);
        fs.unlinkSync(filePath);
        logger.info(`🧹 Removed stale lock file: ${file} from ${userDataDir}`);
      } catch (err: any) {
        // ENOENT = file truly doesn't exist, which is fine
        if (err.code !== 'ENOENT') {
          logger.warn(`⚠️ Failed to remove lock file ${file}: ${err.message}`);
        }
      }
    }
  }

  static async getBrowser(headless: boolean = true, attemptNumber: number = 1, adminId?: string): Promise<Browser> {
    const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
    
    // Check existing browser for this admin
    const existingBrowser = adminId ? this.browsers.get(adminId) : this.browser;
    
    // If browser exists and connected, reuse it
    if (existingBrowser && existingBrowser.connected) {
      return existingBrowser;
    }

    // If browser exists but disconnected, clean up first
    if (existingBrowser) {
      try {
        await existingBrowser.close();
      } catch {
        // Ignore close errors
      }
      if (adminId) {
        this.browsers.delete(adminId);
      } else {
        this.browser = null;
      }
    }

    // Clean stale lock files before launching (prevents hang from copied/crashed profiles)
    this.cleanStaleLockFiles(CHROME_USER_DATA_DIR);

    try {
      logger.info(`🚀 Launching Chrome browser (headless=${headless}) for admin ${adminId || 'default'}...`);
      
      const launchArgs = [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--window-size=1400,900',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--password-store=basic',
          '--use-mock-keychain',
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ];
      
      // For headful (login) mode, enable remote debugging so user can connect from their browser
      if (!headless) {
        launchArgs.push('--remote-debugging-port=9222', '--remote-debugging-address=0.0.0.0');
      }
      
      const browser = await puppeteer.launch({
        headless,
        userDataDir: CHROME_USER_DATA_DIR,
        timeout: 120000, // 2 minutes to launch browser
        args: launchArgs,
        defaultViewport: { width: 1400, height: 900 },
      });

      // Auto-cleanup on disconnect
      browser.on('disconnected', () => {
        if (adminId) {
          this.browsers.delete(adminId);
        } else {
          this.browser = null;
        }
      });

      // Store the browser
      if (adminId) {
        this.browsers.set(adminId, browser);
      } else {
        this.browser = browser;
      }

      // Load saved cookies from file (restores login session after browser restart)
      const cookiesLoaded = await this.loadCookiesViaCDP(browser, adminId);
      if (cookiesLoaded) {
        logger.info(`🍪 Restored login session from saved cookies for admin ${adminId || 'default'}`);
      }

      return browser;
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
            return this.getBrowser(headless, 2, adminId);
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
   * @param adminId - Optional admin ID. If provided, closes only that admin's browser.
   */
  static async closeBrowser(adminId?: string): Promise<void> {
    // Kill VNC/noVNC processes if running
    try {
      const { execSync } = require('child_process');
      execSync('pkill -f x11vnc; pkill -f websockify', { stdio: 'ignore' });
      logger.info('🛑 VNC/noVNC processes stopped');
    } catch { /* ignore - may not be running */ }
    
    if (adminId) {
      this.loginBrowserOpenMap.delete(adminId);
      const browser = this.browsers.get(adminId);
      if (browser) {
        try { await browser.close(); } catch { /* ignore */ }
        this.browsers.delete(adminId);
      }
    } else {
      this.loginBrowserOpen = false;
      if (this.browser) {
        try { await this.browser.close(); } catch { /* ignore */ }
        this.browser = null;
      }
    }
  }

  /**
   * Reset session: close browser and delete the saved Chrome profile/session data
   * @param adminId - Optional admin ID for per-admin session reset
   */
  static async resetSession(adminId?: string): Promise<void> {
    await this.closeBrowser(adminId);
    const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);

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
   * @param adminId - Optional admin ID for per-admin session
   */
  static async openLoginBrowser(adminId?: string): Promise<{ message: string; vncUrl?: string }> {
    try {
      // Close any existing browser (headless) before opening headful login browser
      await this.closeBrowser(adminId);

      if (adminId) {
        this.loginBrowserOpenMap.set(adminId, true);
      } else {
        this.loginBrowserOpen = true;
      }
      const browser = await this.getBrowser(false, 1, adminId); // Explicitly headful for user to login

      // Reset loginBrowserOpen when Chrome is closed by user
      browser.on('disconnected', () => {
        if (adminId) {
          this.loginBrowserOpenMap.delete(adminId);
        } else {
          this.loginBrowserOpen = false;
        }
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
          logger.info(`✅ Headful browser navigated to YouTube Studio — login confirmed for admin ${adminId || 'default'}!`);
          this.markSessionVerified(adminId);
          if (adminId) {
            this.loginBrowserOpenMap.delete(adminId);
          } else {
            this.loginBrowserOpen = false;
          }
          // Save cookies to file for persistence across browser restarts
          // Guard: only save once regardless of how many times framenavigated fires
          if (!this.closeScheduled) {
            this.closeScheduled = true;
            // Wait 5s for cookies to stabilize, then save them
            setTimeout(async () => {
              this.closeScheduled = false;
              await this.saveCookiesViaCDP(browser, adminId);
              logger.info(`✅ Login complete. Browser kept alive for scraping. Cookies saved to file.`);
            }, 5000);
          }
        }
      });

      logger.info(`🌐 Opened VISIBLE browser for YouTube Studio login (admin: ${adminId || 'default'}).`);
      
      // Start x11vnc + noVNC so user can see and control Chrome via web browser
      try {
        const { exec } = require('child_process');
        // Kill any existing VNC/noVNC processes
        exec('pkill -f x11vnc; pkill -f websockify', () => {
          // Start x11vnc (VNC server sharing the Xvfb virtual display)
          exec('x11vnc -display :99 -nopw -listen 0.0.0.0 -xkb -ncache 10 -forever -shared &', (err: any) => {
            if (err) {
              logger.warn(`⚠️ Failed to start x11vnc: ${err.message}`);
            } else {
              logger.info(`✅ x11vnc started on :5900 (sharing Xvfb display :99)`);
            }
          });
          // Start noVNC websockify (web VNC client on port 6080)
          setTimeout(() => {
            exec('websockify --web /usr/share/novnc 6080 localhost:5900 &', (err: any) => {
              if (err) {
                logger.warn(`⚠️ Failed to start noVNC: ${err.message}`);
              } else {
                logger.info(`✅ noVNC started on port 6080 — open http://<VPS_IP>:6080/vnc.html to access Chrome`);
              }
            });
          }, 1000);
        });
      } catch (err: any) {
        logger.warn(`⚠️ noVNC not available: ${err.message}`);
      }
      
      return { 
        message: 'Browser đã mở. Truy cập http://46.62.170.132:6080/vnc.html để nhìn thấy và điều khiển Chrome đăng nhập YouTube Studio.',
        vncUrl: 'http://46.62.170.132:6080/vnc.html',
      };
    } catch (error) {
      if (adminId) {
        this.loginBrowserOpenMap.delete(adminId);
      } else {
        this.loginBrowserOpen = false;
      }
      logger.error('Failed to open login browser:', error);
      throw error;
    }
  }

  /**
   * Extract account info from YouTube Studio page (headless) and cache to file.
   * Returns { channelName, email } - both may be undefined if extraction fails.
   * @param adminId - Optional admin ID for per-admin session
   */
  static async extractAndCacheAccountInfo(adminId?: string): Promise<{ channelName?: string; email?: string }> {
    const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
    const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);
    const isLoginOpen = adminId ? this.loginBrowserOpenMap.get(adminId) : this.loginBrowserOpen;
    
    // Don't run headless operations while headful login browser is open
    if (isLoginOpen) {
      logger.info('⏭️ Skipping extractAndCacheAccountInfo — login browser is open.');
      return {};
    }
    let page = null;
    try {
      const browser = await this.getBrowser(false, 1, adminId); // Headful mode to match login session
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
        await this.closeBrowser(adminId);
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
      this.markSessionVerified(adminId);

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
   * @param adminId - Optional admin ID for per-admin session
   */
  static async checkLoginStatus(adminId?: string): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
    const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);
    const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
    const isLoginOpen = adminId ? this.loginBrowserOpenMap.get(adminId) : this.loginBrowserOpen;
    
    // While login browser is open, check sentinel for real-time login detection
    if (isLoginOpen) {
      if (fs.existsSync(SESSION_VERIFIED_FILE)) {
        // Sentinel was just written by framenavigated — login confirmed
        if (adminId) {
          this.loginBrowserOpenMap.delete(adminId);
        } else {
          this.loginBrowserOpen = false;
        }
      } else {
        return { loggedIn: false };
      }
    }

    const hasSession = this.hasValidSession(adminId);
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
    const verifiedAt = adminId ? (this.sessionVerifiedAtMap.get(adminId) || 0) : this.sessionVerifiedAt;
    const msSinceVerified = Date.now() - verifiedAt;
    const delayMs = Math.max(0, 10000 - msSinceVerified);
    setTimeout(() => this.extractAndCacheAccountInfo(adminId).catch(() => {}), delayMs);
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
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
      logger.info(`✓ Page loaded, current URL: ${page.url()}`);
    } catch (err: any) {
      logger.warn(`⚠️ Page load timeout/error, continuing anyway... URL: ${page.url()}`, err.message);
    }

    // Check if redirected to login
    const currentUrl = page.url();
    if (currentUrl.includes('accounts.google.com')) {
      logger.warn(`🔒 Redirected to login: ${currentUrl}`);
      throw new Error('NOT_LOGGED_IN');
    }

    logger.info(`⏳ Waiting for analytics to render...`);
    await this.waitForAnalytics(page);
    logger.info(`✓ Analytics loaded`);

    logger.info(`⏳ Extracting text...`);
    let text = '';
    // Try up to 3 times with increasing waits if body text is empty
    for (let attempt = 1; attempt <= 3; attempt++) {
      text = await Promise.race([
        page.evaluate('document.body.innerText') as Promise<string>,
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout extracting text (exceeded 120s)')), 120000)
        ),
      ]);
      if (text && text.trim().length > 50) break;
      logger.warn(`⚠️ Text extraction attempt ${attempt}: only ${text.length} chars, waiting ${attempt * 5}s more...`);
      await new Promise(r => setTimeout(r, attempt * 5000));
    }

    logger.info(`✓ Scraped revenue explore (${text.length} chars)`);
    return text;
  }

  /**
   * Step 2: Scrape YouTube Studio revenue explore page for a channel
   * @param month - Optional month in "MM/YYYY" format
   * @param adminId - Optional admin ID for per-admin session
   */
  static async scrapeAnalytics(channelId: string, month?: string, adminId?: string): Promise<YouTubeAnalyticsData> {
    let page: Page | null = null;
    try {
      const browser = await this.getBrowser(false, 1, adminId); // Headful mode to match login session
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
   * @param adminId - Optional admin ID for per-admin session
   */
  static async scrapeMultipleChannels(
    channelIds: string[],
    month?: string,
    onProgress?: (channelId: string, index: number, total: number) => void,
    adminId?: string
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
      browser = await this.getBrowser(false, 1, adminId); // Headful mode via Xvfb (matches login session)
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
      // NOTE: Do NOT close the browser here — keep it alive so the Google session stays valid.
      // Closing and reopening Chrome forces Google to re-validate the session (often fails).
      // The browser stays in the browsers map and is reused on the next scrape call.
      logger.debug('✅ Batch scrape complete. Browser kept alive for next scrape.');
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
    // First wait for the SPA to initialize
    logger.info(`⏳ Waiting for initial render (3s)...`);
    await new Promise(r => setTimeout(r, 3000));
    
    // Try to wait for actual analytics table content
    try {
      await page.waitForSelector('ytcp-table, .data-table, .entity-row, td', { timeout: 30000 });
      logger.info(`✓ Found table/data element`);
    } catch {
      logger.warn(`⚠️ Table selector not found after 30s, trying longer wait...`);
    }
    
    // Additional wait for data to populate
    logger.info(`⏳ Waiting for data to populate (5s)...`);
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
