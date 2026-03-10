import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { BrowserContext, chromium, Page } from 'playwright';
import logger from '../middlewares/logger.middleware';
import { EmailService } from './email.service';
import { ExchangeRateService } from './exchange-rate.service';

// Re-export Page type so socialblade.service.ts can import from here if needed
export type { Page } from 'playwright';

// Base directory for Chrome profiles - each admin gets their own sub-directory
const CHROME_DATA_BASE_DIR = path.join(process.cwd(), '.chrome-data');

/**
 * Get system Chrome profile path (macOS/Linux/Windows).
 * Used when CHROME_USE_SYSTEM_PROFILE=true — no login needed, session from real Chrome.
 */
function getSystemChromeProfileDir(): string | null {
  if (process.env.CHROME_USER_DATA_DIR) return process.env.CHROME_USER_DATA_DIR;
  if (process.platform === 'darwin') {
    return path.join(process.env.HOME || '', 'Library/Application Support/Google/Chrome');
  }
  if (process.platform === 'linux') {
    return path.join(process.env.HOME || '', '.config/google-chrome');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\User Data');
  }
  return null;
}

/** Get per-admin Chrome profile directory */
function getChromeUserDataDir(adminId?: string): string {
  // If system profile mode is enabled, use the real Chrome profile (already logged in)
  if (process.env.CHROME_USE_SYSTEM_PROFILE === 'true') {
    const sysProfile = getSystemChromeProfileDir();
    if (sysProfile) return sysProfile;
  }
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

/**
 * Plaintext cookie cache — written by importCookies (Playwright Chromium),
 * read by getContext() to re-inject into real Chrome via CDP.
 * Needed because Playwright Chromium and real Chrome use different cookie encryption keys.
 */
function getPendingCookiesFile(adminId?: string): string {
  return path.join(getChromeUserDataDir(adminId), 'yt-cookies.json');
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
 * Safely close a Playwright page, ignoring errors if target is already gone
 */
async function safeClosePage(page: Page | null): Promise<void> {
  if (!page) return;
  try {
    await page.close();
  } catch (err: any) {
    if (!err.message?.includes('Target closed') && !err.message?.includes('has been closed')) {
      logger.warn('Error closing page (ignored):', err.message);
    }
  }
}

export class YouTubeScraperService {
  /**
   * Per-admin persistent browser contexts.
   * Playwright's launchPersistentContext() = Browser + userDataDir + full state
   * (cookies, localStorage, IndexedDB). No manual cookie save/load needed.
   */
  private static contexts: Map<string, BrowserContext> = new Map();
  /** Per-admin login browser open flags */
  private static loginBrowserOpenMap: Map<string, boolean> = new Map();
  /** Legacy flag */
  private static loginBrowserOpen: boolean = false;
  /** Throttle session-expired email alerts — track last sent time per adminId */
  private static lastAlertSentAt: Map<string, number> = new Map();
  /** Per-admin session verified timestamps */
  private static sessionVerifiedAtMap: Map<string, number> = new Map();
  /** Per-admin keep-alive interval timers */
  private static keepAliveTimers: Map<string, NodeJS.Timeout> = new Map();
  /** Per-admin last real session verification timestamp */
  private static lastRealVerifyMap: Map<string, number> = new Map();
  /** Track when login browser was opened (per admin) */
  private static loginOpenedAtMap: Map<string, number> = new Map();
  /** Flag to prevent concurrent session verifications */
  private static verifyingSession: boolean = false;
  /** Track the headless Chrome CDP process */
  private static cdpProcess: import('child_process').ChildProcess | null = null;
  /** Flag to pause KeepAlive during batch scraping */
  private static scrapingInProgress: Map<string, boolean> = new Map();
  // /** Prevent concurrent auto-login attempts per admin */
  // private static autoLoginInProgress: Map<string, boolean> = new Map();

  /** Used by other services (e.g. exchange rate) to avoid launching concurrent Chromium instances */
  static isAnyScrapingActive(): boolean {
    return Array.from(this.scrapingInProgress.values()).some(Boolean);
  }

  /** Write per-KOC scrape log to src/logs/{label}_{month}.log */
  private static writeKocLog(
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
      lines.push(`Thời gian   : ${timestamp}`);
      lines.push(`Channel ID  : ${channelId}`);
      lines.push(`Tháng       : ${month || 'unknown'}`);

      if (error) {
        lines.push(`Trạng thái  : ❌ THẤT BẠI`);
        lines.push(`Lỗi         : ${error}`);
      } else if (data) {
        lines.push(`Trạng thái  : ✅ THÀNH CÔNG`);
        lines.push(`Doanh thu   : $${data.totals.estimatedRevenue ?? 0}`);
        lines.push(`Lượt xem    : ${data.totals.views ?? 0}`);
        lines.push(`Giờ xem     : ${data.totals.watchTimeHours ?? 0}`);
        lines.push(`TG xem TB   : ${data.totals.avgWatchTime ?? '-'}`);
        if (data.countries && data.countries.length > 0) {
          lines.push(`--- Doanh thu theo quốc gia ---`);
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
  // SESSION CHECKS
  // ============================================================

  /**
   * Check if session exists without opening browser
   */
  static hasValidSession(adminId?: string): boolean {
    const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);
    if (fs.existsSync(SESSION_VERIFIED_FILE)) {
      logger.info(`Valid session for admin ${adminId || 'default'} (sentinel present)`);
      return true;
    }
    logger.info(`No valid session for admin ${adminId || 'default'} (sentinel missing)`);
    return false;
  }

  /**
   * Record disconnect reason to DB so UI can show detailed error
   */
  static async markSessionDisconnected(reason: string, url?: string, adminId?: string, extra?: Record<string, unknown>): Promise<void> {
    try {
      const sf = getSessionVerifiedFile(adminId);
      if (fs.existsSync(sf)) fs.unlinkSync(sf);
    } catch { /* ignore */ }

    logger.warn(`[Session] Disconnected — reason: "${reason}"${url ? ` url: ${url}` : ''} admin: ${adminId || 'default'}`);

    // Write detailed session disconnect log
    try {
      const logDir = path.join(process.cwd(), 'logs', 'session-errors');
      fs.mkdirSync(logDir, { recursive: true });
      const now = new Date();
      const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
      const fileLabel = now.toISOString().substring(0, 10); // YYYY-MM-DD
      const logFile = path.join(logDir, `${fileLabel}.log`);
      const lines: string[] = [
        `\n${'='.repeat(60)}`,
        `[${dateStr}] SESSION DISCONNECTED`,
        `  Admin   : ${adminId || 'default'}`,
        `  Reason  : ${reason}`,
        url ? `  URL     : ${url}` : `  URL     : (not captured)`,
      ];
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          lines.push(`  ${k.padEnd(8)}: ${String(v).substring(0, 500)}`);
        }
      }
      lines.push('');
      fs.appendFileSync(logFile, lines.join('\n') + '\n');
    } catch { /* ignore log write errors */ }

    if (adminId) {
      try {
        const prisma = (await import('../config/database')).default;
        await prisma.youTubeSession.updateMany({
          where: { admin_id: adminId },
          data: {
            is_logged_in: false,
            disconnected_at: new Date(),
            disconnect_reason: reason,
            disconnect_url: url?.substring(0, 1000) ?? null,
          },
        });
      } catch { /* ignore — DB might not have a row yet */ }
    }

    // /* AUTO-LOGIN DISABLED
    // // Try auto-login before sending email alert
    // if (adminId) {
    //   setImmediate(async () => {
    //     try {
    //       const autoResult = await this.autoLogin(adminId);
    //       if (autoResult.success) {
    //         logger.info(`[Session] Auto-login succeeded — session restored, skipping email`);
    //         return;
    //       }
    //       logger.warn(`[Session] Auto-login failed (${autoResult.reason}) — sending email alert`);
    //     } catch (err: any) {
    //       logger.warn(`[Session] Auto-login error: ${err.message}`);
    //     }
    //     this.notifySessionExpired(adminId).catch(() => {});
    //   });
    //   return;
    // }
    // */

    this.notifySessionExpired(adminId).catch(() => {});
  }

  /**
   * Send session-expired email alert to admin — throttled to once per hour
   */
  private static async notifySessionExpired(adminId?: string): Promise<void> {
    const key = adminId || '__default__';
    const last = this.lastAlertSentAt.get(key) || 0;
    const ONE_HOUR = 60 * 60 * 1000;
    if (Date.now() - last < ONE_HOUR) {
      logger.info(`[Alert] Throttled — already sent session alert for ${key} within last hour`);
      return;
    }
    this.lastAlertSentAt.set(key, Date.now());

    try {
      let adminEmail: string | null | undefined;
      if (adminId) {
        const prisma = (await import('../config/database')).default;
        adminEmail = (await prisma.user.findUnique({ where: { id: adminId }, select: { email: true } }))?.email;
      } else {
        adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
      }

      if (!adminEmail) {
        logger.warn(`[Alert] No admin email found for ${key} — cannot send alert`);
        return;
      }

      logger.info(`[Alert] Sending session expired email to ${adminEmail}...`);
      await EmailService.sendSessionExpiredAlert(adminEmail);
    } catch (err: any) {
      logger.error(`[Alert] Failed to send session expired email: ${err.message}`);
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
      if (adminId) {
        this.sessionVerifiedAtMap.set(adminId, Date.now());
        this.lastRealVerifyMap.set(adminId, Date.now());
      }
      logger.info(`Session marked as verified for admin ${adminId || 'default'}.`);
    } catch { /* ignore */ }
  }

  // ============================================================
  // CREDENTIAL ENCRYPTION
  // ============================================================

  private static getEncryptionKey(): Buffer {
    return crypto.scryptSync(process.env.JWT_SECRET || 'koc-default-key', 'yt-cred-salt-v1', 32);
  }

  static encryptPassword(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  static decryptPassword(encryptedText: string): string {
    const key = this.getEncryptionKey();
    const [ivHex, encHex] = encryptedText.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  }

  // ============================================================
  // AUTO-LOGIN — DISABLED (methods removed, trigger commented out above)
  // ============================================================

  // autoLogin() removed — restore from git if needed

  // ============================================================
  // KEEP-ALIVE
  // ============================================================

  /**
   * Keep-alive: chỉ kiểm tra context còn sống không, KHÔNG navigate thêm trang.
   * Tránh gửi request đều đặn đến Google (dễ bị bot detection).
   * Context Playwright persistent tự refresh OAuth token nội bộ khi còn trong memory.
   * Navigate thực sự chỉ xảy ra khi scrape — đó là hành vi tự nhiên nhất.
   */
  private static startKeepAlive(adminId?: string): void {
    const key = adminId || '__default__';
    const existing = this.keepAliveTimers.get(key);
    if (existing) clearInterval(existing);

    const KEEP_ALIVE_INTERVAL = 30 * 60 * 1000; // 30 phút — chỉ check, không navigate

    const timer = setInterval(async () => {
      try {
        if (this.scrapingInProgress.get(key)) return;
        const isLoginOpen = adminId ? this.loginBrowserOpenMap.get(adminId) : this.loginBrowserOpen;
        if (isLoginOpen) return;

        const sentinelExists = fs.existsSync(getSessionVerifiedFile(adminId));
        if (!sentinelExists) {
          // Sentinel đã bị xóa (session chết được phát hiện lúc scrape)
          const t = this.keepAliveTimers.get(key);
          if (t) { clearInterval(t); this.keepAliveTimers.delete(key); }
          logger.debug(`[KeepAlive] Sentinel gone for ${key} — stopping timer`);
          return;
        }

        const context = this.contexts.get(key);
        if (!context) {
          // Context bị mất (server restart) — relaunch lazy để refresh tokens từ disk profile
          logger.info(`[KeepAlive] Context gone for ${key} — relaunching from saved profile...`);
          try {
            await this.getContext(true, adminId);
            logger.info(`[KeepAlive] Context restored for ${key}`);
          } catch (err: any) {
            logger.warn(`[KeepAlive] Failed to restore context for ${key}: ${err.message}`);
          }
          return;
        }

        // Context còn sống → không cần làm gì thêm
        logger.debug(`[KeepAlive] Context alive for ${key} — no action needed`);
      } catch (err: any) {
        logger.warn(`[KeepAlive] Error for ${key}: ${err.message}`);
      }
    }, KEEP_ALIVE_INTERVAL);

    this.keepAliveTimers.set(key, timer);
    logger.info(`[KeepAlive] Timer started for ${key} (check every ${KEEP_ALIVE_INTERVAL / 60000} min, no page visits)`);
  }

  /**
   * On server startup: scan chrome-data for existing sessions and log them.
   * NOTE: We do NOT launch browsers on startup to avoid OOM on low-memory VPS.
   * Sessions will be restored on-demand when a scrape/login is requested.
   */
  static async initializePersistentSessions(): Promise<void> {
    logger.info('[Session Init] Scanning for existing YouTube sessions...');
    const found: Array<string | undefined> = [];

    if (this.hasValidSession(undefined)) {
      found.push(undefined);
    }

    if (fs.existsSync(CHROME_DATA_BASE_DIR)) {
      try {
        const entries = fs.readdirSync(CHROME_DATA_BASE_DIR, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const aid = entry.name;
          if (this.hasValidSession(aid)) {
            found.push(aid);
          }
        }
      } catch (err: any) {
        logger.warn(`[Session Init] Error scanning sessions: ${err.message}`);
      }
    }

    if (found.length === 0) {
      logger.info('[Session Init] No existing sessions found.');
      return;
    }

    logger.info(`[Session Init] Found ${found.length} saved session(s): ${found.map((a) => a || 'default').join(', ')}.`);

    // Start keep-alive timers immediately so sessions stay alive without needing a scrape first.
    // The timer will lazily launch the browser context on first tick (not right now) to save RAM.
    for (const adminId of found) {
      this.startKeepAlive(adminId);
      logger.info(`[Session Init] Keep-alive started for ${adminId || 'default'}`);
    }
  }

  private static stopKeepAlive(adminId?: string): void {
    const key = adminId || '__default__';
    const timer = this.keepAliveTimers.get(key);
    if (timer) {
      clearInterval(timer);
      this.keepAliveTimers.delete(key);
    }
  }

  // ============================================================
  // BROWSER CONTEXT MANAGEMENT (Playwright Persistent Context)
  // ============================================================

  /**
   * Remove stale Chrome lock files that prevent browser launch
   */
  private static cleanStaleLockFiles(userDataDir: string): void {
    // SAFETY: Never delete lock files from the system Chrome profile — Chrome may be running
    const sysProfile = getSystemChromeProfileDir();
    if (sysProfile && userDataDir.startsWith(sysProfile)) {
      logger.debug(`[LockClean] Skipping system Chrome profile: ${userDataDir}`);
      return;
    }

    // Check if a Chrome process is actively using this profile by reading SingletonLock
    const lockPath = path.join(userDataDir, 'SingletonLock');
    try {
      const target = fs.readlinkSync(lockPath); // SingletonLock is a symlink to hostname-pid
      const pidMatch = target.match(/-(\d+)$/);
      if (pidMatch) {
        const pid = parseInt(pidMatch[1], 10);
        try {
          process.kill(pid, 0); // signal 0 = just check existence
          logger.warn(`[LockClean] Chrome PID ${pid} is still running with this profile — skipping lock cleanup`);
          return; // Chrome is alive, don't touch its locks
        } catch { /* PID doesn't exist — lock is stale, safe to clean */ }
      }
    } catch { /* lock doesn't exist or isn't a symlink — fine */ }

    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    for (const file of lockFiles) {
      const filePath = path.join(userDataDir, file);
      try {
        fs.lstatSync(filePath);
        fs.unlinkSync(filePath);
        logger.info(`Removed stale lock file: ${file} from ${userDataDir}`);
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          logger.warn(`Failed to remove lock file ${file}: ${err.message}`);
        }
      }
    }
  }

  /**
   * Get or create a Playwright persistent browser context.
   *
   * Key difference from Puppeteer:
   * - `launchPersistentContext(userDataDir)` persists EVERYTHING: cookies, localStorage,
   *   IndexedDB, service workers — no manual cookie save/load needed.
   * - Google's refresh tokens are stored in localStorage -> session survives browser restarts.
   *
   * @param headless - false = visible via Xvfb+VNC for login; true would be headless
   * @param adminId - Optional admin ID for per-admin Chrome profile
   */
  /** Get real Chrome executable path based on platform */
  static getRealChromePath(): string | null {
    if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
    if (process.platform === 'darwin') {
      const p = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      if (fs.existsSync(p)) return p;
    }
    if (process.platform === 'linux') {
      for (const p of ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser']) {
        if (fs.existsSync(p)) return p;
      }
    }
    if (process.platform === 'win32') {
      const candidates = [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) return p;
      }
    }
    return null;
  }

  /** Whether CDP mode is active (real Chrome via remote debugging) */
  static isCDPMode(): boolean {
    return !!(process.env.CHROME_CDP_URL);
  }

  /**
   * Start Chrome headlessly with --remote-debugging-port for CDP scraping.
   * Called after login is verified — Chrome runs invisibly in background.
   * Session is read from user-data-dir so no re-login needed.
   */
  static async startHeadlessChrome(adminId?: string): Promise<boolean> {
    const realChrome = this.getRealChromePath();
    if (!realChrome) {
      logger.warn('[CDP] No real Chrome found — cannot start headless Chrome');
      return false;
    }

    const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
    const CDP_PORT = 9222;

    // Kill existing CDP process first
    if (this.cdpProcess) {
      try { this.cdpProcess.kill('SIGTERM'); } catch { /* ignore */ }
      this.cdpProcess = null;
      await new Promise(r => setTimeout(r, 1500));
    }

    // Also kill any stale Chrome holding the SingletonLock on this profile.
    // This happens when the previous cdpProcess exited (clearing this.cdpProcess) but the
    // OS process is still alive (e.g. zombie or slow to die), preventing a new Chrome from
    // using the same user-data-dir (exit code 21 = "profile already in use").
    const lockPath = path.join(CHROME_USER_DATA_DIR, 'SingletonLock');
    try {
      const target = fs.readlinkSync(lockPath);
      const pidMatch = target.match(/-(\d+)$/);
      if (pidMatch) {
        const stalePid = parseInt(pidMatch[1], 10);
        try {
          process.kill(stalePid, 0); // check it's alive
          logger.info(`[CDP] Killing stale Chrome PID ${stalePid} holding SingletonLock...`);
          process.kill(stalePid, 'SIGTERM');
          await new Promise(r => setTimeout(r, 1000));
          // Force kill if still alive
          try { process.kill(stalePid, 'SIGKILL'); } catch { /* already gone */ }
          await new Promise(r => setTimeout(r, 500));
        } catch { /* PID already dead — safe to proceed */ }
      }
    } catch { /* no lock file — clean start */ }

    // Remove stale lock files after killing the old process
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    for (const lf of lockFiles) {
      try { fs.unlinkSync(path.join(CHROME_USER_DATA_DIR, lf)); } catch { /* ignore ENOENT */ }
    }

    const { spawn } = require('child_process');
    const isMac = process.platform === 'darwin';
    const isWin = process.platform === 'win32';
    const args = [
      `--user-data-dir=${CHROME_USER_DATA_DIR}`,
      `--remote-debugging-port=${CDP_PORT}`,
      '--headless=new',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      // Hide automation signals that Google uses to detect headless bots
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-client-side-phishing-detection',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--metrics-recording-only',
      // On macOS: let Chrome use Keychain so it can decrypt cookies saved by regular Chrome.
      // On Linux/Windows: use basic store (no Keychain available).
      ...(isMac ? [] : ['--password-store=basic', '--use-mock-keychain']),
      ...(!isWin ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
    ];

    const child = spawn(realChrome, args, { stdio: 'ignore', detached: false });
    this.cdpProcess = child;
    process.env.CHROME_CDP_URL = `http://localhost:${CDP_PORT}`;

    child.on('exit', (code: number | null) => {
      logger.info(`[CDP] Headless Chrome exited (code=${code})`);
      this.cdpProcess = null;
      process.env.CHROME_CDP_URL = '';
      const key = adminId || '__default__';
      this.contexts.delete(key);
    });

    // Wait for Chrome to bind the debugging port
    await new Promise(r => setTimeout(r, 2500));
    logger.info(`[CDP] Headless Chrome started (pid=${child.pid}, port=${CDP_PORT}) — no window, full stealth`);
    return true;
  }

  /**
   * Verify session by navigating to studio.youtube.com and checking the URL.
   * - If CDP Chrome is already running: reuse the existing context (no new process needed).
   * - If not: spawn a headless Chrome on port 9223 (separate from scraping port 9222).
   * Never opens a visible window.
   */
  static async openVerifyTab(adminId?: string): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
    // If CDP Chrome is already running, use it directly — no need to spawn a second instance
    // (two Chrome processes cannot share the same user-data-dir).
    const cdpUrl = process.env.CHROME_CDP_URL;
    if (cdpUrl) {
      logger.info('[VerifyTab] CDP already running — verifying via existing context');
      return this._verifyViaContext(adminId);
    }

    // No CDP running — spawn a temporary headless Chrome on a separate port
    const realChrome = this.getRealChromePath();
    if (!realChrome) {
      logger.info('[VerifyTab] No real Chrome — falling back to Playwright verify');
      return this.closeLoginAndVerify(adminId);
    }

    const CHROME_USER_DATA_DIR = adminId
      ? path.join(CHROME_DATA_BASE_DIR, adminId)
      : CHROME_DATA_BASE_DIR;
    const VERIFY_PORT = 9223;

    const { spawn } = require('child_process');
    const args = [
      '--headless=new',
      `--user-data-dir=${CHROME_USER_DATA_DIR}`,
      `--remote-debugging-port=${VERIFY_PORT}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
    ];

    logger.info('[VerifyTab] Spawning headless Chrome on port 9223 for verification...');
    const child = spawn(realChrome, args, { stdio: 'ignore', detached: false });
    const killChild = () => { try { child.kill('SIGTERM'); } catch { /* ignore */ } };

    try {
      await new Promise(r => setTimeout(r, 3000));
      const { chromium: pw } = require('playwright');
      const browser = await pw.connectOverCDP(`http://localhost:${VERIFY_PORT}`, { timeout: 10000 });
      const ctx = browser.contexts()[0] ?? await browser.newContext();
      const page: Page = ctx.pages()[0] ?? await ctx.newPage();

      await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const result = await this._extractVerifyResult(page, adminId);
      await browser.close().catch(() => {});
      killChild();
      return result;
    } catch (err: any) {
      logger.warn(`[VerifyTab] Spawn verify failed: ${err.message} — falling back to Playwright verify`);
      killChild();
      return this.closeLoginAndVerify(adminId);
    }
  }

  /** Verify session by reusing the existing Playwright browser context. */
  private static async _verifyViaContext(adminId?: string): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
    let page: Page | null = null;
    try {
      const context = await this.getContext(true, adminId);
      page = await context.newPage();
      await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const result = await this._extractVerifyResult(page, adminId);
      await safeClosePage(page);
      return result;
    } catch (err: any) {
      logger.warn(`[VerifyTab] Context verify failed: ${err.message}`);
      if (page) await safeClosePage(page).catch(() => {});
      return { loggedIn: false };
    }
  }

  /** Extract channel/email from a Studio page and mark session accordingly. */
  private static async _extractVerifyResult(
    page: Page,
    adminId?: string
  ): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
    const url = page.url();
    logger.info(`[VerifyTab] URL: ${url}`);

    if (url.includes('accounts.google.com') || url.includes('signin')) {
      logger.warn('[VerifyTab] Not logged in — redirected to Google login');
      return { loggedIn: false };
    }

    const title = await page.title().catch(() => '');
    const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;

    let email: string | undefined;
    try {
      email = ((await page.evaluate(() => {
        for (const sel of ['[aria-label*="@"]', '[title*="@"]', 'button[aria-label*="Google"]']) {
          const el = document.querySelector(sel);
          if (el) {
            const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
            const match = label.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
            if (match) return match[0];
          }
        }
        return null;
      })) as string | null) ?? undefined;
    } catch { /* ignore */ }

    this.markSessionVerified(adminId);
    try {
      fs.writeFileSync(getAccountInfoFile(adminId), JSON.stringify({
        channelName, email, extractedAt: new Date().toISOString(),
      }, null, 2));
    } catch { /* ignore */ }

    logger.info(`[VerifyTab] Session verified! Channel: ${channelName}, Email: ${email || 'unknown'}`);
    return { loggedIn: true, channelName, email };
  }

  static async getContext(_headless: boolean = true, adminId?: string): Promise<BrowserContext> {
    const key = adminId || '__default__';

    // Reuse existing context if still open
    const existing = this.contexts.get(key);
    if (existing) {
      try {
        void existing.pages(); // just check context is still alive (sync check)
        return existing;
      } catch {
        this.contexts.delete(key);
      }
    }

    // ── CDP MODE: connect to real Chrome via remote debugging ──
    const cdpUrl = process.env.CHROME_CDP_URL;
    if (cdpUrl) {
      logger.info(`[CDP] Connecting to real Chrome at ${cdpUrl}...`);
      try {
        const { chromium: pw } = require('playwright');
        const browser = await pw.connectOverCDP(cdpUrl, { timeout: 15000 });
        const contexts = browser.contexts();
        const context: BrowserContext = contexts.length > 0 ? contexts[0] : await browser.newContext();

        context.on('close', () => {
          this.contexts.delete(key);
          this.stopKeepAlive(adminId);
          logger.warn('[CDP] Chrome context closed — reconnect on next request');
        });

        this.contexts.set(key, context);
        this.startKeepAlive(adminId);
        // Patch navigator.webdriver so Google cannot detect automation
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        }).catch(() => {});
        logger.info('[CDP] Connected to real Chrome — session is native, no detection risk');
        return context;
      } catch (err: any) {
        throw new Error(
          `[CDP] Cannot connect to Chrome at ${cdpUrl}. ` +
          `Make sure Chrome is running: use "Mở trình duyệt" to launch it. Error: ${err.message}`
        );
      }
    }

    // ── REAL CHROME via CDP (auto-start headless Chrome, then connect) ──
    // launchPersistentContext with real Chrome is broken (--remote-debugging-pipe incompatibility).
    // Instead: spawn Chrome directly with --headless=new --remote-debugging-port, then connectOverCDP.
    const realChromePath = this.getRealChromePath();
    if (realChromePath) {
      logger.info(`[Context] Real Chrome found — auto-starting headless CDP for admin ${adminId || 'default'}...`);
      const started = await this.startHeadlessChrome(adminId);
      if (started) {
        const autoCdpUrl = process.env.CHROME_CDP_URL;
        if (autoCdpUrl) {
          try {
            const { chromium: pw } = require('playwright');
            const browser = await pw.connectOverCDP(autoCdpUrl, { timeout: 15000 });
            const contexts = browser.contexts();
            const context: BrowserContext = contexts.length > 0 ? contexts[0] : await browser.newContext();
            context.on('close', () => {
              this.contexts.delete(key);
              this.stopKeepAlive(adminId);
              logger.warn('[CDP] Chrome context closed — will restart on next request');
            });
            this.contexts.set(key, context);
            this.startKeepAlive(adminId);
            // Patch navigator.webdriver so Google cannot detect automation
            await context.addInitScript(() => {
              Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            }).catch(() => {});
            logger.info('[CDP] Auto-connected to headless real Chrome via CDP');

            // Inject pending cookies (saved by importCookies) into real Chrome via CDP.
            // This is necessary because Playwright Chromium and Google Chrome use different
            // cookie encryption keys — cookies written by one cannot be read by the other.
            const pendingFile = getPendingCookiesFile(adminId);
            if (fs.existsSync(pendingFile)) {
              try {
                const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf-8'));
                await context.addCookies(pending);
                fs.unlinkSync(pendingFile);
                logger.info(`[CDP] Injected ${pending.length} pending cookies into real Chrome`);
              } catch (cookieErr: any) {
                logger.warn(`[CDP] Failed to inject pending cookies: ${cookieErr.message}`);
              }
            }

            return context;
          } catch (err: any) {
            logger.warn(`[CDP] Auto-connect failed: ${err.message} — killing CDP Chrome before Playwright fallback`);
            // Kill the CDP Chrome process before Playwright uses the same profile
            if (this.cdpProcess) {
              try { this.cdpProcess.kill('SIGTERM'); } catch { /* ignore */ }
              this.cdpProcess = null;
            }
            process.env.CHROME_CDP_URL = '';
            await new Promise(r => setTimeout(r, 1500)); // wait for Chrome to release profile
          }
        }
      }
    }

    // ── PLAYWRIGHT CHROMIUM (fallback when no real Chrome) ──
    const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
    this.cleanStaleLockFiles(CHROME_USER_DATA_DIR);
    fs.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });

    logger.info(`Launching Playwright Chromium for admin ${adminId || 'default'}...`);
    const context = await chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--password-store=basic',
        '--use-mock-keychain',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-translate',
        '--metrics-recording-only',
        '--disable-sync',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-software-rasterizer',
        '--js-flags=--max-old-space-size=512',
      ],
      viewport: { width: 1400, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      timeout: 120000,
      ignoreHTTPSErrors: true,
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      (window as any).chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });
      try {
        const originalQuery = window.navigator.permissions.query.bind(navigator.permissions);
        (navigator.permissions as any).query = (parameters: any) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: (typeof Notification !== 'undefined' ? Notification.permission : 'default') } as PermissionStatus)
            : originalQuery(parameters);
      } catch { /* ignore */ }
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    });

    context.on('close', () => {
      this.contexts.delete(key);
      this.stopKeepAlive(adminId);
    });

    this.contexts.set(key, context);
    this.startKeepAlive(adminId);
    return context;
  }

  /**
   * Close the browser context (and raw login Chromium if running)
   */
  static async closeBrowser(adminId?: string): Promise<void> {
    // Kill raw login Chromium process if running
    if (this.loginProcess) {
      try {
        this.loginProcess.kill('SIGTERM');
        logger.info('Raw login Chromium process killed');
      } catch { /* ignore */ }
      this.loginProcess = null;
    }

    // Kill VNC/noVNC processes if running
    try {
      const { execSync } = require('child_process');
      execSync('pkill -f x11vnc; pkill -f websockify', { stdio: 'ignore' });
      logger.info('VNC/noVNC processes stopped');
    } catch { /* ignore */ }

    const key = adminId || '__default__';
    if (adminId) {
      this.loginBrowserOpenMap.delete(adminId);
    } else {
      this.loginBrowserOpen = false;
    }
    this.stopKeepAlive(adminId);

    const context = this.contexts.get(key);
    if (context) {
      try {
        await context.close();
      } catch { /* ignore */ }
      this.contexts.delete(key);
    }
  }

  /**
   * Reset session: close browser and delete the saved Chrome profile/session data
   */
  static async resetSession(adminId?: string): Promise<void> {
    await this.closeBrowser(adminId);
    const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);

    if (!fs.existsSync(CHROME_USER_DATA_DIR)) return;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let lastError: unknown;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await sleep(attempt * 500);
        fs.rmSync(CHROME_USER_DATA_DIR, { recursive: true, force: true });
        logger.info('Chrome session data deleted.');
        return;
      } catch (err) {
        lastError = err;
        logger.warn(`Attempt ${attempt} to delete chrome-data failed, retrying...`);
      }
    }
    throw lastError;
  }

  // ============================================================
  // LOGIN BROWSER (headful via VNC) — RAW Chromium (no Playwright automation flags)
  // ============================================================

  /** Track the raw Chromium child process used for login */
  private static loginProcess: import('child_process').ChildProcess | null = null;

  /**
   * Open a RAW Chromium browser (NOT through Playwright) for manual Google login.
   *
   * Why raw? Playwright injects --enable-automation and sets navigator.webdriver=true,
   * which causes Google to reject sign-in ("This browser or app may not be secure").
   * By spawning Chromium directly we get a clean, undetected browser.
   *
   * The session data is stored in the same userDataDir that Playwright later reads,
   * so cookies/localStorage persist across the login→scrape flow.
   */
  static async openLoginBrowser(
    adminId?: string
  ): Promise<{ message: string; vncUrl?: string }> {
    try {
      // Close any existing Playwright/CDP context AND any lingering Chrome processes
      await this.closeBrowser(adminId);
      if (this.cdpProcess) {
        try { this.cdpProcess.kill('SIGTERM'); } catch { /* ignore */ }
        this.cdpProcess = null;
        process.env.CHROME_CDP_URL = '';
        await new Promise(r => setTimeout(r, 1000));
      }

      if (adminId) {
        this.loginBrowserOpenMap.set(adminId, true);
      } else {
        this.loginBrowserOpen = true;
      }

      const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
      this.cleanStaleLockFiles(CHROME_USER_DATA_DIR);
      fs.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });

      // Prefer real Chrome (macOS/Linux), fall back to bundled Chromium
      const realChrome = this.getRealChromePath();
      const chromiumPath = realChrome || process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium';
      const isRealChrome = !!realChrome;

      logger.info(`[Login] Using browser: ${chromiumPath} (real Chrome: ${isRealChrome})`);

      // Base args — NO automation flags, NO remote debugging (avoids "controlled by test software" banner)
      const args = [
        `--user-data-dir=${CHROME_USER_DATA_DIR}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-infobars',
        '--window-size=1400,900',
        ...(isRealChrome ? [] : [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--password-store=basic',
          '--use-mock-keychain',
        ]),
        // NOTE: NO --remote-debugging-port here — that flag triggers the
        // "Chrome is being controlled by automated test software" banner
        // which causes Google to reject the login with signin/rejected.
        // After user logs in, closeLoginAndVerify reads cookies from the
        // profile directory via launchPersistentContext (no CDP needed).
        'https://studio.youtube.com',
      ];

      const { spawn, exec } = require('child_process');

      // Launch raw Chromium
      const child = spawn(chromiumPath, args, {
        stdio: 'ignore',
        detached: false,
        env: { ...process.env },
      });

      this.loginProcess = child;

      child.on('exit', (code: number | null) => {
        logger.info(`Login Chromium exited (code=${code}) for admin ${adminId || 'default'}`);
        this.loginProcess = null;
        if (adminId) {
          this.loginBrowserOpenMap.delete(adminId);
        } else {
          this.loginBrowserOpen = false;
        }
        // Only auto-mark verified if NOT currently being verified by closeLoginAndVerify
        // (to avoid brief false positives before proper Playwright verification)
        if (!this.verifyingSession) {
          if (fs.existsSync(path.join(CHROME_USER_DATA_DIR, 'Default', 'Cookies')) ||
              fs.existsSync(path.join(CHROME_USER_DATA_DIR, 'Default', 'Local State'))) {
            this.markSessionVerified(adminId);
            logger.info(`Session marked as verified for admin ${adminId || 'default'} after browser closed.`);
          }
        }
      });

      child.on('error', (err: any) => {
        logger.error(`Login Chromium spawn error: ${err.message}`);
        this.loginProcess = null;
        if (adminId) {
          this.loginBrowserOpenMap.delete(adminId);
        } else {
          this.loginBrowserOpen = false;
        }
      });

      this.loginOpenedAtMap.set(adminId || '__default__', Date.now());

      logger.info(
        `Opened RAW Chromium (no automation flags) for login (admin: ${adminId || 'default'}, pid: ${child.pid}).`
      );

      // Start x11vnc + noVNC so user can see and control Chrome via web browser
      try {
        const xDisplay = process.env.DISPLAY || ':99';
        logger.info(`Starting VNC on display ${xDisplay}`);
        exec('pkill -f x11vnc; pkill -f websockify', () => {
          exec(
            `x11vnc -display ${xDisplay} -nopw -listen 0.0.0.0 -xkb -ncache 10 -forever -shared &`,
            (err: any) => {
              if (err) {
                logger.warn(`Failed to start x11vnc: ${err.message}`);
              } else {
                logger.info(`x11vnc started on :5900 (sharing Xvfb display ${xDisplay})`);
              }
            }
          );
          setTimeout(() => {
            exec(
              'websockify --web /usr/share/novnc 6080 localhost:5900 &',
              (err: any) => {
                if (err) {
                  logger.warn(`Failed to start noVNC: ${err.message}`);
                } else {
                  logger.info('noVNC started on port 6080');
                }
              }
            );
          }, 1000);
        });
      } catch (err: any) {
        logger.warn(`noVNC not available: ${err.message}`);
      }

      return {
        message:
          'Browser da mo (khong co automation flags). Truy cap VNC de dang nhap YouTube Studio.',
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

  // ============================================================
  // ACCOUNT INFO & LOGIN STATUS
  // ============================================================

  /**
   * Extract account info from YouTube Studio page and cache to file.
   */
  static async extractAndCacheAccountInfo(
    adminId?: string
  ): Promise<{ channelName?: string; email?: string }> {
    const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
    const isLoginOpen = adminId
      ? this.loginBrowserOpenMap.get(adminId)
      : this.loginBrowserOpen;

    if (isLoginOpen) {
      logger.info('Skipping extractAndCacheAccountInfo — login browser is open.');
      return {};
    }
    let page: Page | null = null;
    try {
      const context = await this.getContext(true, adminId);
      page = await context.newPage();

      await page.goto('https://studio.youtube.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // If redirected to Google login, session is invalid
      if (page.url().includes('accounts.google.com')) {
        logger.warn('Not logged in (redirected to Google login)');
        const redirectUrl = page.url();
        const pageTitle = await page.title().catch(() => '');
        const bodySnippet = await page.evaluate(() => document.body?.innerText?.substring(0, 300)).catch(() => '') as string;
        await safeClosePage(page);
        await this.closeBrowser(adminId);
        this.markSessionDisconnected('account_info_redirect', redirectUrl, adminId, {
          pageTitle,
          bodySnippet,
          trigger: 'extractAndCacheAccountInfo',
        }).catch(() => {});
        return {};
      }

      await page.waitForTimeout(3000);

      const title = await page.title();
      const channelName =
        title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;

      let email: string | undefined;
      try {
        email =
          ((await page.evaluate(() => {
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
                const label =
                  el.getAttribute('aria-label') || el.getAttribute('title') || '';
                const match = label.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
                if (match) return match[0];
              }
            }
            return null;
          })) as string | null) ?? undefined;
      } catch { /* ignore */ }

      logger.info(
        `Account info extracted: channel="${channelName}" email="${email || 'unknown'}"`
      );

      this.markSessionVerified(adminId);

      const info = {
        channelName,
        email,
        extractedAt: new Date().toISOString(),
      };
      try {
        fs.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify(info, null, 2));
      } catch { /* ignore */ }

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
  static async checkLoginStatus(
    adminId?: string
  ): Promise<{ loggedIn: boolean; channelName?: string; email?: string; loginBrowserOpen?: boolean }> {
    const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);
    const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
    const isLoginOpen = adminId
      ? this.loginBrowserOpenMap.get(adminId)
      : this.loginBrowserOpen;

    if (isLoginOpen) {
      if (fs.existsSync(SESSION_VERIFIED_FILE)) {
        if (adminId) {
          this.loginBrowserOpenMap.delete(adminId);
        } else {
          this.loginBrowserOpen = false;
        }
      } else {
        // Login browser still open, not verified yet — report waiting
        // Do NOT auto-close: user needs time to complete Google login + 2FA via VNC
        // User clicks "Xác nhận đăng nhập" button when done
        return { loggedIn: false, loginBrowserOpen: true };
      }
    }

    const hasSession = this.hasValidSession(adminId);
    if (!hasSession) {
      // Xóa cache cũ để không hiện sai thông tin kênh
      try { if (fs.existsSync(ACCOUNT_INFO_FILE)) fs.unlinkSync(ACCOUNT_INFO_FILE); } catch { /* ignore */ }
      return { loggedIn: false };
    }

    if (fs.existsSync(ACCOUNT_INFO_FILE)) {
      try {
        const raw = fs.readFileSync(ACCOUNT_INFO_FILE, 'utf-8');
        const info = JSON.parse(raw);

        // Chỉ đọc cache — không tự navigate để tránh bot detection
        return {
          loggedIn: true,
          channelName: info.channelName,
          email: info.email,
        };
      } catch { /* ignore */ }
    }

    // Không có account-info.json → trả loggedIn: true nhưng không navigate tự động
    // User có thể click "Tải lại" để lấy thông tin tài khoản thủ công
    return { loggedIn: true };
  }

  // ============================================================
  // LOGIN VERIFICATION (close raw browser + headless Playwright check)
  // ============================================================

  /**
   * Close the raw login Chromium and verify the session with headless Playwright.
   * Used automatically by checkLoginStatus after 30s, or manually via verify-session endpoint.
   */
  static async closeLoginAndVerify(
    adminId?: string
  ): Promise<{ loggedIn: boolean; channelName?: string; email?: string; loginBrowserOpen?: boolean }> {
    this.verifyingSession = true;
    const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);

    try {
      // ── CDP MODE: only when CHROME_CDP_URL is explicitly set ──
      const cdpUrl = process.env.CHROME_CDP_URL;

      if (cdpUrl) {
        // Real Chrome is still running with --remote-debugging-port=9222
        // Don't kill it — just connect and verify
        if (adminId) this.loginBrowserOpenMap.delete(adminId);
        else this.loginBrowserOpen = false;

        logger.info('[closeLoginAndVerify] CDP mode — verifying via existing Chrome...');
        let page: Page | null = null;
        try {
          // Set CDP URL so getContext uses it
          process.env.CHROME_CDP_URL = cdpUrl;
          const context = await this.getContext(true, adminId);
          page = await context.newPage();
          await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(2000);

          const url = page.url();
          if (url.includes('accounts.google.com') || url.includes('signin')) {
            logger.warn('[closeLoginAndVerify] CDP: Not logged in');
            process.env.CHROME_CDP_URL = '';
            return { loggedIn: false };
          }

          const title = await page.title();
          const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;
          this.markSessionVerified(adminId);
          const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
          try { fs.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify({ channelName, extractedAt: new Date().toISOString() }, null, 2)); } catch { /* ignore */ }
          logger.info(`[closeLoginAndVerify] CDP: Session verified! Channel: ${channelName}`);

          // Kill the headed login Chrome and restart headlessly
          if (page) { await safeClosePage(page); page = null; }
          const key = adminId || '__default__';
          this.contexts.delete(key);
          if (this.loginProcess) {
            try { this.loginProcess.kill('SIGTERM'); } catch { /* ignore */ }
            this.loginProcess = null;
          }
          await new Promise(r => setTimeout(r, 1500));
          await this.startHeadlessChrome(adminId);
          logger.info('[CDP] Switched to headless Chrome — browser window closed, scraping runs invisibly');
          return { loggedIn: true, channelName };
        } catch (err: any) {
          logger.warn(`[closeLoginAndVerify] CDP verify failed: ${err.message}`);
          process.env.CHROME_CDP_URL = '';
          // Fall through to Playwright verification below
        } finally {
          if (page) await safeClosePage(page);
        }
      }

      // ── PLAYWRIGHT MODE: kill Chrome, verify with headless Playwright ──
      if (this.loginProcess) {
        try { this.loginProcess.kill('SIGTERM'); } catch { /* ignore */ }
        this.loginProcess = null;
      }
      if (adminId) this.loginBrowserOpenMap.delete(adminId);
      else this.loginBrowserOpen = false;

      await new Promise((r) => setTimeout(r, 3000));
      this.cleanStaleLockFiles(CHROME_USER_DATA_DIR);

      let tempContext: BrowserContext | null = null;
      let page: Page | null = null;
      try {
        tempContext = await chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
          headless: true,
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
          timeout: 30000,
          ignoreHTTPSErrors: true,
        });

        page = await tempContext.newPage();
        await page.goto('https://studio.youtube.com', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await page.waitForTimeout(3000);

        const url = page.url();
        if (url.includes('accounts.google.com') || url.includes('signin')) {
          logger.warn('[closeLoginAndVerify] Session not established — redirected to Google login');
          // Clean up false sentinel file if exit handler created it
          try {
            const sf = getSessionVerifiedFile(adminId);
            if (fs.existsSync(sf)) fs.unlinkSync(sf);
          } catch { /* ignore */ }
          return { loggedIn: false };
        }

        // Session is valid!
        const title = await page.title();
        const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;

        // Extract email if possible
        let email: string | undefined;
        try {
          email = ((await page.evaluate(() => {
            const selectors = [
              '[aria-label*="@"]', '[title*="@"]',
              'yt-img-shadow[aria-label]', '#avatar-btn',
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
          })) as string | null) ?? undefined;
        } catch { /* ignore */ }

        this.markSessionVerified(adminId);

        // Cache account info
        const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
        try {
          fs.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify({
            channelName, email, extractedAt: new Date().toISOString(),
          }, null, 2));
        } catch { /* ignore */ }

        logger.info(`[closeLoginAndVerify] Session verified! Channel: ${channelName}, Email: ${email || 'unknown'}`);
        return { loggedIn: true, channelName, email };
      } finally {
        if (page) await safeClosePage(page);
        if (tempContext) {
          try { await tempContext.close(); } catch { /* ignore */ }
        }
      }
    } catch (err: any) {
      logger.warn(`[closeLoginAndVerify] Error: ${err.message}`);
      return { loggedIn: false };
    } finally {
      this.verifyingSession = false;
    }
  }

  // ============================================================
  // COOKIE IMPORT (alternative to VNC login)
  // ============================================================

  /**
   * Auto-sync cookies from a running Chrome instance (via CDP).
   * Requires Chrome to be open with --remote-debugging-port=9222 and logged in to YouTube Studio.
   * No browser extension needed — server reads cookies directly via Playwright CDP.
   */
  static async syncFromChrome(
    cdpUrl?: string,
    adminId?: string
  ): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
    const url = cdpUrl || process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222';
    logger.info(`[SyncFromChrome] Connecting to Chrome at ${url}...`);

    const { chromium: pw } = require('playwright');
    let browser: any = null;

    try {
      browser = await pw.connectOverCDP(url, { timeout: 10000 });
      const contexts = browser.contexts();
      const context = contexts.length > 0 ? contexts[0] : await browser.newContext();

      // Extract ALL cookies from Chrome (no URL filter — get everything including .google.com)
      const allCookies = await context.cookies();
      const ytCookies = allCookies.filter((c: any) =>
        c.domain.includes('google.com') ||
        c.domain.includes('youtube.com') ||
        c.domain.includes('googleapis.com')
      );

      logger.info(`[SyncFromChrome] Got ${allCookies.length} total cookies, ${ytCookies.length} Google/YouTube cookies`);

      if (ytCookies.length === 0) {
        logger.warn('[SyncFromChrome] No Google/YouTube cookies found — make sure Chrome is logged in to YouTube Studio');
        return { loggedIn: false };
      }

      // Log key auth cookies for debugging (name only, not value)
      const keyNames = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID', 'LOGIN_INFO'];
      const foundKeys = ytCookies.filter((c: any) => keyNames.includes(c.name)).map((c: any) => `${c.name}(exp:${c.expires > 0 ? new Date(c.expires * 1000).toISOString().slice(0, 10) : 'session'})`);
      logger.info(`[SyncFromChrome] Key auth cookies: ${foundKeys.join(', ') || 'none'}`);

      // Disconnect from Chrome before importing (avoid lock conflicts)
      await browser.close().catch(() => {});
      browser = null;

      // Import into Playwright persistent profile
      const result = await this.importCookies(ytCookies, adminId);

      // After successful import, immediately start keep-alive so context stays warm
      if (result.loggedIn) {
        this.startKeepAlive(adminId);
        // Pre-warm context in background (don't block response)
        this.getContext(true, adminId).catch((err: any) =>
          logger.warn(`[SyncFromChrome] Context pre-warm failed: ${err.message}`)
        );
      }

      return result;
    } catch (err: any) {
      logger.error(`[SyncFromChrome] Failed: ${err.message}`);
      throw new Error(`Cannot connect to Chrome at ${url}. Make sure Chrome is running with --remote-debugging-port=9222. Error: ${err.message}`);
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  /**
   * Import cookies from user's local browser to establish YouTube session.
   * User exports cookies using Chrome extension (e.g. Cookie-Editor) on studio.youtube.com,
   * then pastes the JSON here. Server writes cookies into a headless Playwright profile
   * and verifies the session works.
   *
   * Cookie format: Array of { name, value, domain, path, ... }
   */
  static async importCookies(
    cookies: Array<{
      name: string;
      value: string;
      domain: string;
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: string;
      expirationDate?: number;
    }>,
    adminId?: string
  ): Promise<{ loggedIn: boolean; channelName?: string; email?: string }> {
    const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
    const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);

    // Close any existing context
    await this.closeBrowser(adminId);

    // Clean stale files
    this.cleanStaleLockFiles(CHROME_USER_DATA_DIR);
    fs.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });

    let tempContext: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      // Launch headless Playwright persistent context on the user data dir
      tempContext = await chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
        headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
        timeout: 30000,
        ignoreHTTPSErrors: true,
      });

      // Convert Cookie-Editor / Playwright-CDP format to Playwright addCookies format.
      // expirationDate = Cookie-Editor (unix seconds), expires = Playwright CDP format.
      // Session cookies (expires = -1 or missing) are kept as session cookies.
      const playwrightCookies = cookies.map((c) => {
        const rawExpires = c.expirationDate ?? (c as any).expires;
        const expires = rawExpires && rawExpires > 0 ? Math.floor(rawExpires) : undefined;

        const ss = c.sameSite;
        const sameSite: 'None' | 'Lax' | 'Strict' =
          ss === 'no_restriction' || ss === 'None' ? 'None'
          : ss === 'lax' || ss === 'Lax' ? 'Lax'
          : ss === 'strict' || ss === 'Strict' ? 'Strict'
          : 'Lax'; // safe default (was 'Strict' before, which breaks cross-site cookies)

        return {
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path || '/',
          httpOnly: c.httpOnly ?? false,
          secure: c.secure ?? true,
          sameSite,
          ...(expires !== undefined ? { expires } : {}),
        };
      });

      const persistentCount = playwrightCookies.filter((c) => (c as any).expires !== undefined).length;
      logger.info(`[importCookies] Adding ${playwrightCookies.length} cookies (${persistentCount} persistent, ${playwrightCookies.length - persistentCount} session) for admin ${adminId || 'default'}...`);

      // Add cookies to context
      await tempContext.addCookies(playwrightCookies);

      // Navigate to YouTube Studio to verify
      page = await tempContext.newPage();
      await page.goto('https://studio.youtube.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForTimeout(5000);

      const url = page.url();
      if (url.includes('accounts.google.com') || url.includes('signin')) {
        logger.warn('[importCookies] Session not valid — redirected to Google login');
        // Clean up invalid sentinel
        try { if (fs.existsSync(SESSION_VERIFIED_FILE)) fs.unlinkSync(SESSION_VERIFIED_FILE); } catch { /* ignore */ }
        return { loggedIn: false };
      }

      // Success — extract account info
      const title = await page.title();
      const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;

      let email: string | undefined;
      try {
        email = ((await page.evaluate(() => {
          const selectors = [
            '[aria-label*="@"]', '[title*="@"]',
            'yt-img-shadow[aria-label]', '#avatar-btn',
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
        })) as string | null) ?? undefined;
      } catch { /* ignore */ }

      this.markSessionVerified(adminId);

      // Cache account info
      const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
      try {
        fs.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify({
          channelName, email, extractedAt: new Date().toISOString(),
        }, null, 2));
      } catch { /* ignore */ }

      // Save plaintext cookies so real Chrome (CDP) can re-inject them with correct encryption.
      // Playwright Chromium and Google Chrome use different cookie encryption keys on macOS,
      // so cookies written by Playwright cannot be read by real Chrome and vice versa.
      try {
        fs.writeFileSync(getPendingCookiesFile(adminId), JSON.stringify(playwrightCookies, null, 2));
        logger.info(`[importCookies] Saved ${playwrightCookies.length} cookies for CDP Chrome to pick up`);
      } catch { /* ignore */ }

      logger.info(`[importCookies] Session verified! Channel: ${channelName}, Email: ${email || 'unknown'}`);
      return { loggedIn: true, channelName, email };
    } catch (err: any) {
      logger.error(`[importCookies] Error: ${err.message}`);
      return { loggedIn: false };
    } finally {
      if (page) await safeClosePage(page);
      if (tempContext) {
        try { await tempContext.close(); } catch { /* ignore */ }
      }
    }
  }

  // ============================================================
  // URL / CHANNEL HELPERS
  // ============================================================

  static cleanChannelId(raw: string): string {
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

  private static buildRevenueExploreUrl(
    channelId: string,
    month?: string
  ): string {
    const cleanId = this.cleanChannelId(channelId);
    let timePeriodParam = 'time_period=minus_1_month';

    if (month) {
      const [mm, yyyy] = month.split('/');
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
  private static async scrapeRevenueExplore(
    page: Page,
    channelId: string,
    month?: string
  ): Promise<string> {
    const url = this.buildRevenueExploreUrl(channelId, month);
    logger.info(
      `Scraping revenue explore for channel: ${channelId}${month ? ` (month: ${month})` : ''}`
    );

    // Navigate to blank first to reduce memory pressure
    try { await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }); } catch { /* ignore */ }
    // Random pre-navigation delay (1-3s) to mimic human pace
    await new Promise(r => setTimeout(r, 1000 + Math.floor(Math.random() * 2000)));

    try {
      logger.info('Navigating to revenue explore page...');
      // Use domcontentloaded instead of networkidle to avoid loading all resources
      // Short timeout (30s) — fail fast and let the caller handle retry
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
    const cleanId = this.cleanChannelId(channelId);
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
  static async scrapeAnalytics(
    channelId: string,
    month?: string,
    adminId?: string
  ): Promise<YouTubeAnalyticsData> {
    let page: Page | null = null;
    try {
      const context = await this.getContext(true, adminId);
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

      const result = await this.scrapeChannelWithPage(page, channelId, month);
      return result;
    } finally {
      await safeClosePage(page);
    }
  }

  /**
   * Scrape multiple channels sequentially - REUSES same page for efficiency
   */
  static async scrapeMultipleChannels(
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
    this.scrapingInProgress.set(scrapeKey, true);

    /**
     * Helper: open fresh page → block heavy resources → scrape one channel → close page.
     * Each channel gets its OWN page so V8 heap is fully freed after every channel.
     */
    const scrapeOneChannel = async (channelId: string): Promise<YouTubeAnalyticsData> => {
      let page: Page | null = null;
      try {
        const context = await this.getContext(true, adminId);
        page = await context.newPage();

        // Block heavy resources (images, fonts, media, CSS) to save RAM
        await page.route('**/*', (route) => {
          const type = route.request().resourceType();
          if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
            return route.abort();
          }
          return route.continue();
        });

        const result = await this.scrapeChannelWithPage(page, channelId, month);
        return result;
      } finally {
        // Always close the page to free V8 heap memory before next channel
        await safeClosePage(page);
      }
    };

    /**
     * SOFT reset: navigate all open pages to about:blank and close extras,
     * but KEEP exactly ONE blank page open so the persistent context stays alive
     * (closing all pages kills the launchPersistentContext → context goes dead).
     * Used between channel batches to reclaim renderer heap without re-login.
     */
    const softReset = async () => {
      const existingCtx = this.contexts.get(adminId || '__default__');
      if (!existingCtx) return;
      try {
        const pages = existingCtx.pages();
        if (pages.length === 0) return;

        // Navigate first page to blank (keep it as the "holder" page)
        try {
          await pages[0].goto('about:blank', { waitUntil: 'commit', timeout: 3000 });
        } catch { /* ignore */ }

        // Close all extra pages (index 1+)
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
      // Give GC a moment to reclaim freed heap
      await new Promise(r => setTimeout(r, 3000));
    };

    /**
     * HARD reset: used ONLY when a crash is detected. Closes context fully,
     * kills zombie chromium processes, then relaunches on next scrape call.
     */
    const resetContext = async () => {
      const existingCtx = this.contexts.get(adminId || '__default__');
      if (existingCtx) {
        try { await existingCtx.close(); } catch { /* ignore */ }
        this.contexts.delete(adminId || '__default__');
      }
      try {
        const { execSync } = require('child_process');
        execSync('pkill -9 -f chromium || true', { stdio: 'ignore', timeout: 5000 });
        logger.info('Killed zombie chromium processes');
      } catch { /* ignore */ }
      // Allow OS to reclaim freed RAM
      await new Promise(r => setTimeout(r, 5000));
    };

    /**
     * Navigate studio.youtube.com to fully restore session from persistent profile.
     * Only needed after a cold context launch (brand-new or post-crash relaunch).
     * Skipped when context is already warm (pages from a previous request exist).
     */
    const warmUpSession = async (reason: string) => {
      logger.info(`Warming up browser session (${reason})...`);
      let warmPage: Page | null = null;
      try {
        const context = await this.getContext(true, adminId);
        warmPage = await context.newPage();
        await warmPage.route('**/*', (route) => {
          const type = route.request().resourceType();
          if (['image', 'font', 'media', 'stylesheet'].includes(type)) return route.abort();
          return route.continue();
        });
        await warmPage.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const warmUrl = warmPage.url();
        if (warmUrl.includes('accounts.google.com')) {
          const bodySnippet = await warmPage.evaluate(() => document.body?.innerText?.substring(0, 300)).catch(() => '') as string;
          logger.error(`[WarmUp] Session expired — redirected to: ${warmUrl}`);
          logger.error(`[WarmUp] Page snippet: ${bodySnippet.substring(0, 200)}`);
          // Write to session error log immediately (scrapeAllKOCs will call markSessionDisconnected separately)
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
      // Only warm up if context is cold (no live pages = first launch or post-crash relaunch).
      // Skipping on existing warm context avoids 11× studio navigations when UI
      // fires one request per KOC — those redundant navigations trigger Google rate-limits.
      const existingCtxForWarmCheck = this.contexts.get(adminId || '__default__');
      const isContextCold = !existingCtxForWarmCheck || existingCtxForWarmCheck.pages().length === 0;
      if (isContextCold) {
        await warmUpSession('cold start');
      } else {
        logger.info('Browser context already warm — skipping studio warm-up');
      }

      // Concurrency: sequential (1) for large batches to avoid Google session kill,
      // parallel (2) for small batches. Tune via env var if needed.
      const CONCURRENCY = total > 10 ? 1 : 2;
      // Delay between batches: longer for large batches to avoid rate-limiting
      const BATCH_DELAY_MS = total > 10 ? 8000 : 4000;
      // Every N batches, do a studio homepage visit to "reset" Google's request counter
      const SESSION_REFRESH_EVERY = 5;

      // Split channelIds into chunks of CONCURRENCY
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

        // Notify progress for each channel in this batch
        chunk.forEach((channelId, idx) => {
          if (onProgress) onProgress(channelId, batchStart + idx, total);
        });

        // Run CONCURRENCY channels simultaneously
        const chunkResults = await Promise.allSettled(
          chunk.map(channelId => scrapeOneChannel(channelId))
        );

        // Collect results
        for (let j = 0; j < chunkResults.length; j++) {
          const channelId = chunk[j];
          const r = chunkResults[j];
          if (r.status === 'fulfilled') {
            results.push(r.value);
            logger.info(`[Batch ${batchIdx + 1}] ✓ ${channelId}`);
            this.writeKocLog(channelId, month, r.value, null, channelLabels);
          } else {
            const errMsg = r.reason?.message || 'Unknown error';
            errors.push({ channelId, error: errMsg });
            logger.warn(`[Batch ${batchIdx + 1}] ✗ ${channelId}: ${errMsg}`);
            this.writeKocLog(channelId, month, null, errMsg, channelLabels);
            if (errMsg === 'NOT_LOGGED_IN') sessionExpired = true;
          }
        }

        if (sessionExpired) {
          // Verify session before giving up — might be a transient redirect
          logger.warn('NOT_LOGGED_IN detected in batch — verifying session...');
          try {
            await warmUpSession('session verify after NOT_LOGGED_IN');
            logger.info('Session still valid — will retry failed channels in retry pass');
            sessionExpired = false;
          } catch (verifyErr: any) {
            if (verifyErr.message === 'NOT_LOGGED_IN') {
              logger.error('Session truly expired — stopping scrape.');
              const failedChannels = errors.filter(e => e.error === 'NOT_LOGGED_IN').map(e => e.channelId);
              this.markSessionDisconnected('scrape_not_logged_in', undefined, adminId, {
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

        // Between batches: soft reset + delay + periodic session refresh
        if (batchIdx < chunks.length - 1 && !sessionExpired) {
          await softReset();

          // Every SESSION_REFRESH_EVERY batches: visit studio homepage to reset Google's request counter
          if ((batchIdx + 1) % SESSION_REFRESH_EVERY === 0) {
            logger.info(`[Session] Refreshing session after batch ${batchIdx + 1} to avoid rate-limit...`);
            try {
              await warmUpSession(`periodic refresh after ${batchIdx + 1} batches`);
            } catch { /* ignore — scrape continues */ }
          }

          // Random delay: base + jitter to mimic human behavior
          const jitter = Math.floor(Math.random() * 3000);
          const delay = BATCH_DELAY_MS + jitter;
          logger.info(`[Throttle] Waiting ${delay}ms before next batch...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }

      // ── RETRY PASS: retry failed channels once (skip NOT_LOGGED_IN) ──
      const retryableErrors = errors.filter(e => !e.error.includes('NOT_LOGGED_IN'));
      if (retryableErrors.length > 0) {
        const failedChannels = retryableErrors.map(e => e.channelId);
        logger.info(`🔄 Retrying ${failedChannels.length} failed channel(s)...`);

        for (let i = 0; i < failedChannels.length; i++) {
          const channelId = failedChannels[i];
          try {
            logger.info(`[Retry ${i + 1}/${failedChannels.length}] Channel: ${channelId}`);
            const data = await scrapeOneChannel(channelId);
            results.push(data);
            const errIdx = errors.findIndex(e => e.channelId === channelId);
            if (errIdx >= 0) errors.splice(errIdx, 1);
            logger.info(`[Retry ${i + 1}/${failedChannels.length}] ✓ Recovered`);
            if (i < failedChannels.length - 1) {
              await new Promise(r => setTimeout(r, 2000));
            }
          } catch (retryErr: any) {
            logger.warn(`[Retry ${i + 1}/${failedChannels.length}] ✗ Still failed: ${retryErr.message}`);
            const isCrash = retryErr.message?.includes('Target crashed') ||
                            retryErr.message?.includes('Target closed') ||
                            retryErr.message?.includes('SCRAPE_TIMEOUT');
            if (isCrash) await resetContext();
          }
        }

        const recovered = failedChannels.length - errors.filter(e => !e.error.includes('NOT_LOGGED_IN')).length;
        logger.info(`🔄 Retry done: ${recovered} recovered`);
      }

      logger.info(`Batch complete: ${results.length} success, ${errors.length} failed`);

      if (results.length > 0) {
        this.markSessionVerified(adminId);
        logger.info(`Session verified after batch scrape for admin ${adminId || 'default'}`);
      }

      return { results, errors };
    } finally {
      // Soft-reset context to free renderer memory BEFORE next request
      // This is critical when client sends 1-channel requests sequentially:
      // without this, Chromium accumulates RAM across requests → OOM after 4-5 channels
      try {
        await softReset();
        logger.info('[Memory] Post-batch soft reset done — context ready for next request');
      } catch (rErr: any) {
        logger.warn(`[Memory] Post-batch soft reset failed (non-fatal): ${rErr.message}`);
      }
      // Resume KeepAlive
      this.scrapingInProgress.set(scrapeKey, false);
      logger.debug('Batch scrape complete. Persistent context kept alive for next scrape.');
    }
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Core scraping logic - uses provided page (reusable for batch operations)
   */
  private static async scrapeChannelWithPage(
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
        const rawText = await this.scrapeRevenueExplore(
          page,
          channelId,
          month
        );
        const parsed = this.parseRevenueExploreText(rawText);

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
  // PARSING (identical to Puppeteer version)
  // ============================================================

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
          const rowValues = this.extractTableRowValues(lines, i + 1, 4);
          logContent += `\nExtracted values: [${rowValues.map((v) => `"${v}"`).join(', ')}] (count: ${rowValues.length})\n`;
          logger.info(
            `TOTAL ROW - Raw values: [${rowValues.join(', ')}]`
          );
          if (rowValues.length >= 1) {
            const revParsed = this.parseRevenueValue(rowValues[0]);
            totals.estimatedRevenue = revParsed;
            logContent += `  [0] "${rowValues[0]}" -> Revenue = ${revParsed}\n`;
            logger.info(
              `   [Total] Revenue field: "${rowValues[0]}" -> ${totals.estimatedRevenue}`
            );
          }
          if (rowValues.length >= 2) {
            const viewsParsed = this.parseIntegerValue(rowValues[1]);
            totals.views = viewsParsed;
            logContent += `  [1] "${rowValues[1]}" -> Views = ${viewsParsed}\n`;
            logger.info(
              `   [Total] Views field: "${rowValues[1]}" -> ${totals.views}`
            );
          }
          if (rowValues.length >= 3) {
            const wtParsed = this.parseDecimalValue(rowValues[2]);
            totals.watchTimeHours = wtParsed;
            logContent += `  [2] "${rowValues[2]}" -> WatchTime = ${wtParsed}\n`;
            logger.info(
              `   [Total] WatchTime field: "${rowValues[2]}" -> ${totals.watchTimeHours}`
            );
          }
          if (rowValues.length >= 4) {
            totals.avgWatchTime = this.parseTimeValue(rowValues[3]);
            logContent += `  [3] "${rowValues[3]}" -> AvgTime = ${totals.avgWatchTime}\n`;
          }
          logContent += `\nFinal totals: revenue=${totals.estimatedRevenue}, views=${totals.views}, watchTime=${totals.watchTimeHours}\n`;
          logger.info(
            `   [Total] Final: revenue=${totals.estimatedRevenue}, views=${totals.views}`
          );
          continue;
        }

        if (foundTotal) {
          if (this.isCountryName(line)) {
            const country = line;
            const rowValues = this.extractTableRowValues(lines, i + 1, 8);
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
                  countryData.estimatedRevenue = this.parseRevenueValue(val);
                  valueIdx = 1;
                  logger.debug(
                    `     -> Revenue = ${countryData.estimatedRevenue}, move to idx=1`
                  );
                } else if (/^[\d.,]+$/.test(val)) {
                  countryData.estimatedRevenue = 0;
                  countryData.views = this.parseIntegerValue(val);
                  valueIdx = 3;
                  logger.debug(
                    `     -> No $ sign: Revenue = 0, Views = ${countryData.views}, move to idx=3`
                  );
                }
              } else if (valueIdx === 1 && /%/.test(val)) {
                countryData.revenuePercent = this.parsePercentValue(val);
                valueIdx = 2;
                logger.debug(
                  `     -> RevenuePercent = ${countryData.revenuePercent}, move to idx=2`
                );
              } else if (valueIdx === 2 && /^[\d.,]+$/.test(val)) {
                countryData.views = this.parseIntegerValue(val);
                valueIdx = 3;
                logger.debug(
                  `     -> Views = ${countryData.views}, move to idx=3`
                );
              } else if (valueIdx === 3 && /%/.test(val)) {
                countryData.viewsPercent = this.parsePercentValue(val);
                valueIdx = 4;
                logger.debug(
                  `     -> ViewsPercent = ${countryData.viewsPercent}, move to idx=4`
                );
              } else if (valueIdx === 4 && /^[\d.,]+$/.test(val)) {
                countryData.watchTimeHours = this.parseDecimalValue(val);
                valueIdx = 5;
                logger.debug(
                  `     -> WatchTimeHours = ${countryData.watchTimeHours}, move to idx=5`
                );
              } else if (valueIdx === 5 && /%/.test(val)) {
                countryData.watchTimePercent = this.parsePercentValue(val);
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
                countryData.views = this.parseIntegerValue(val);
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

  private static extractTableRowValues(
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
        this.isCountryName(line) ||
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

  private static isCountryName(line: string): boolean {
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

  private static parseRevenueValue(str: string): number | null {
    if (!str || str === '-' || str === '—') return 0;

    if (str.includes('₫')) {
      const vndCleaned = str.replace(/[₫\s]/g, '');
      if (!vndCleaned) return 0;
      const vndAmount = this.parseNumber(vndCleaned);
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
    const num = this.parseNumber(cleaned);
    return isNaN(num) ? 0 : num;
  }

  private static parsePercentValue(str: string): number | null {
    if (!str) return null;
    const cleaned = str.replace(/%/g, '').trim();
    if (!cleaned) return null;
    const num = this.parseNumber(cleaned);
    return isNaN(num) ? null : num;
  }

  private static parseIntegerValue(str: string): number | null {
    if (!str) return null;
    const cleaned = this.normalizeNumber(str);
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? null : num;
  }

  private static parseDecimalValue(str: string): number | null {
    if (!str) return null;
    const num = this.parseNumber(str);
    return num || null;
  }

  private static parseTimeValue(str: string): string | null {
    if (!str) return null;
    const match = str.match(/(\d{1,2}:\d{2})/);
    return match ? match[1] : null;
  }

  private static normalizeNumber(str: string): string {
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

  private static parseNumber(str: string): number {
    if (!str) return 0;
    const cleaned = this.normalizeNumber(str);
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 1000000) / 1000000;
  }
}
