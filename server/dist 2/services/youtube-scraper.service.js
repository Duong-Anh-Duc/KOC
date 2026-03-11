"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeScraperService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const playwright_1 = require("playwright");
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
const email_service_1 = require("./email.service");
const exchange_rate_service_1 = require("./exchange-rate.service");
// Base directory for Chrome profiles - each admin gets their own sub-directory
const CHROME_DATA_BASE_DIR = path_1.default.join(process.cwd(), '.chrome-data');
/**
 * Get system Chrome profile path (macOS/Linux/Windows).
 * Used when CHROME_USE_SYSTEM_PROFILE=true — no login needed, session from real Chrome.
 */
function getSystemChromeProfileDir() {
    if (process.env.CHROME_USER_DATA_DIR)
        return process.env.CHROME_USER_DATA_DIR;
    if (process.platform === 'darwin') {
        return path_1.default.join(process.env.HOME || '', 'Library/Application Support/Google/Chrome');
    }
    if (process.platform === 'linux') {
        return path_1.default.join(process.env.HOME || '', '.config/google-chrome');
    }
    if (process.platform === 'win32') {
        return path_1.default.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\User Data');
    }
    return null;
}
/** Get per-admin Chrome profile directory */
function getChromeUserDataDir(adminId) {
    // If system profile mode is enabled, use the real Chrome profile (already logged in)
    if (process.env.CHROME_USE_SYSTEM_PROFILE === 'true') {
        const sysProfile = getSystemChromeProfileDir();
        if (sysProfile)
            return sysProfile;
    }
    if (adminId) {
        return path_1.default.join(CHROME_DATA_BASE_DIR, adminId);
    }
    return CHROME_DATA_BASE_DIR;
}
/** Get per-admin account info file */
function getAccountInfoFile(adminId) {
    return path_1.default.join(getChromeUserDataDir(adminId), 'account-info.json');
}
/** Get per-admin session verified sentinel file */
function getSessionVerifiedFile(adminId) {
    return path_1.default.join(getChromeUserDataDir(adminId), 'session-verified');
}
/**
 * Plaintext cookie cache — written by importCookies (Playwright Chromium),
 * read by getContext() to re-inject into real Chrome via CDP.
 * Needed because Playwright Chromium and real Chrome use different cookie encryption keys.
 */
function getPendingCookiesFile(adminId) {
    return path_1.default.join(getChromeUserDataDir(adminId), 'yt-cookies.json');
}
/**
 * Safely close a Playwright page, ignoring errors if target is already gone
 */
async function safeClosePage(page) {
    if (!page)
        return;
    try {
        await page.close();
    }
    catch (err) {
        if (!err.message?.includes('Target closed') && !err.message?.includes('has been closed')) {
            logger_middleware_1.default.warn('Error closing page (ignored):', err.message);
        }
    }
}
class YouTubeScraperService {
    /**
     * Per-admin persistent browser contexts.
     * Playwright's launchPersistentContext() = Browser + userDataDir + full state
     * (cookies, localStorage, IndexedDB). No manual cookie save/load needed.
     */
    static contexts = new Map();
    /** Per-admin login browser open flags */
    static loginBrowserOpenMap = new Map();
    /** Legacy flag */
    static loginBrowserOpen = false;
    /** Throttle session-expired email alerts — track last sent time per adminId */
    static lastAlertSentAt = new Map();
    /** Per-admin session verified timestamps */
    static sessionVerifiedAtMap = new Map();
    /** Per-admin keep-alive interval timers */
    static keepAliveTimers = new Map();
    /** Per-admin last real session verification timestamp */
    static lastRealVerifyMap = new Map();
    /** Track when login browser was opened (per admin) */
    static loginOpenedAtMap = new Map();
    /** Flag to prevent concurrent session verifications */
    static verifyingSession = false;
    /** Track the headless Chrome CDP process */
    static cdpProcess = null;
    /** Flag to pause KeepAlive during batch scraping */
    static scrapingInProgress = new Map();
    // /** Prevent concurrent auto-login attempts per admin */
    // private static autoLoginInProgress: Map<string, boolean> = new Map();
    /** Used by other services (e.g. exchange rate) to avoid launching concurrent Chromium instances */
    static isAnyScrapingActive() {
        return Array.from(this.scrapingInProgress.values()).some(Boolean);
    }
    /** Write per-KOC scrape log to src/logs/{label}_{month}.log */
    static writeKocLog(channelId, month, data, error, channelLabels) {
        try {
            const logsDir = path_1.default.join(process.cwd(), 'logs', 'revenue');
            if (!fs_1.default.existsSync(logsDir))
                fs_1.default.mkdirSync(logsDir, { recursive: true });
            const label = (channelLabels?.get(channelId) || channelId).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u0300-\u036f\p{L}]/gu, '_');
            const monthTag = (month || 'unknown').replace('/', '-');
            const filePath = path_1.default.join(logsDir, `${label}_${monthTag}.log`);
            const timestamp = new Date().toLocaleString('vi-VN');
            const lines = [];
            lines.push(`========================================`);
            lines.push(`Thời gian   : ${timestamp}`);
            lines.push(`Channel ID  : ${channelId}`);
            lines.push(`Tháng       : ${month || 'unknown'}`);
            if (error) {
                lines.push(`Trạng thái  : ❌ THẤT BẠI`);
                lines.push(`Lỗi         : ${error}`);
            }
            else if (data) {
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
            fs_1.default.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
        }
        catch (err) {
            logger_middleware_1.default.warn(`[Log] Failed to write KOC log for ${channelId}: ${err.message}`);
        }
    }
    // ============================================================
    // SESSION CHECKS
    // ============================================================
    /**
     * Check if session exists without opening browser
     */
    static hasValidSession(adminId) {
        const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);
        if (fs_1.default.existsSync(SESSION_VERIFIED_FILE)) {
            logger_middleware_1.default.info(`Valid session for admin ${adminId || 'default'} (sentinel present)`);
            return true;
        }
        logger_middleware_1.default.info(`No valid session for admin ${adminId || 'default'} (sentinel missing)`);
        return false;
    }
    /**
     * Record disconnect reason to DB so UI can show detailed error
     */
    static async markSessionDisconnected(reason, url, adminId, extra) {
        try {
            const sf = getSessionVerifiedFile(adminId);
            if (fs_1.default.existsSync(sf))
                fs_1.default.unlinkSync(sf);
        }
        catch { /* ignore */ }
        logger_middleware_1.default.warn(`[Session] Disconnected — reason: "${reason}"${url ? ` url: ${url}` : ''} admin: ${adminId || 'default'}`);
        // Write detailed session disconnect log
        try {
            const logDir = path_1.default.join(process.cwd(), 'logs', 'session-errors');
            fs_1.default.mkdirSync(logDir, { recursive: true });
            const now = new Date();
            const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
            const fileLabel = now.toISOString().substring(0, 10); // YYYY-MM-DD
            const logFile = path_1.default.join(logDir, `${fileLabel}.log`);
            const lines = [
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
            fs_1.default.appendFileSync(logFile, lines.join('\n') + '\n');
        }
        catch { /* ignore log write errors */ }
        if (adminId) {
            try {
                const prisma = (await Promise.resolve().then(() => __importStar(require('../config/database')))).default;
                await prisma.youTubeSession.updateMany({
                    where: { admin_id: adminId },
                    data: {
                        is_logged_in: false,
                        disconnected_at: new Date(),
                        disconnect_reason: reason,
                        disconnect_url: url?.substring(0, 1000) ?? null,
                    },
                });
            }
            catch { /* ignore — DB might not have a row yet */ }
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
        this.notifySessionExpired(adminId).catch(() => { });
    }
    /**
     * Send session-expired email alert to admin — throttled to once per hour
     */
    static async notifySessionExpired(adminId) {
        const key = adminId || '__default__';
        const last = this.lastAlertSentAt.get(key) || 0;
        const ONE_HOUR = 60 * 60 * 1000;
        if (Date.now() - last < ONE_HOUR) {
            logger_middleware_1.default.info(`[Alert] Throttled — already sent session alert for ${key} within last hour`);
            return;
        }
        this.lastAlertSentAt.set(key, Date.now());
        try {
            let adminEmail;
            if (adminId) {
                const prisma = (await Promise.resolve().then(() => __importStar(require('../config/database')))).default;
                adminEmail = (await prisma.user.findUnique({ where: { id: adminId }, select: { email: true } }))?.email;
            }
            else {
                adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
            }
            if (!adminEmail) {
                logger_middleware_1.default.warn(`[Alert] No admin email found for ${key} — cannot send alert`);
                return;
            }
            logger_middleware_1.default.info(`[Alert] Sending session expired email to ${adminEmail}...`);
            await email_service_1.EmailService.sendSessionExpiredAlert(adminEmail);
        }
        catch (err) {
            logger_middleware_1.default.error(`[Alert] Failed to send session expired email: ${err.message}`);
        }
    }
    /**
     * Write the session-verified sentinel file to mark a confirmed login
     */
    static markSessionVerified(adminId) {
        try {
            const dir = getChromeUserDataDir(adminId);
            const file = getSessionVerifiedFile(adminId);
            fs_1.default.mkdirSync(dir, { recursive: true });
            fs_1.default.writeFileSync(file, new Date().toISOString());
            if (adminId) {
                this.sessionVerifiedAtMap.set(adminId, Date.now());
                this.lastRealVerifyMap.set(adminId, Date.now());
            }
            logger_middleware_1.default.info(`Session marked as verified for admin ${adminId || 'default'}.`);
        }
        catch { /* ignore */ }
    }
    // ============================================================
    // CREDENTIAL ENCRYPTION
    // ============================================================
    static getEncryptionKey() {
        return crypto_1.default.scryptSync(process.env.JWT_SECRET || 'koc-default-key', 'yt-cred-salt-v1', 32);
    }
    static encryptPassword(plaintext) {
        const key = this.getEncryptionKey();
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv('aes-256-cbc', key, iv);
        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
    }
    static decryptPassword(encryptedText) {
        const key = this.getEncryptionKey();
        const [ivHex, encHex] = encryptedText.split(':');
        const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
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
    static startKeepAlive(adminId) {
        const key = adminId || '__default__';
        const existing = this.keepAliveTimers.get(key);
        if (existing)
            clearInterval(existing);
        const KEEP_ALIVE_INTERVAL = 30 * 60 * 1000; // 30 phút — chỉ check, không navigate
        const timer = setInterval(async () => {
            try {
                if (this.scrapingInProgress.get(key))
                    return;
                const isLoginOpen = adminId ? this.loginBrowserOpenMap.get(adminId) : this.loginBrowserOpen;
                if (isLoginOpen)
                    return;
                const sentinelExists = fs_1.default.existsSync(getSessionVerifiedFile(adminId));
                if (!sentinelExists) {
                    // Sentinel đã bị xóa (session chết được phát hiện lúc scrape)
                    const t = this.keepAliveTimers.get(key);
                    if (t) {
                        clearInterval(t);
                        this.keepAliveTimers.delete(key);
                    }
                    logger_middleware_1.default.debug(`[KeepAlive] Sentinel gone for ${key} — stopping timer`);
                    return;
                }
                const context = this.contexts.get(key);
                if (!context) {
                    // Context bị mất (server restart) — relaunch lazy để refresh tokens từ disk profile
                    logger_middleware_1.default.info(`[KeepAlive] Context gone for ${key} — relaunching from saved profile...`);
                    try {
                        await this.getContext(true, adminId);
                        logger_middleware_1.default.info(`[KeepAlive] Context restored for ${key}`);
                    }
                    catch (err) {
                        logger_middleware_1.default.warn(`[KeepAlive] Failed to restore context for ${key}: ${err.message}`);
                    }
                    return;
                }
                // Context còn sống → không cần làm gì thêm
                logger_middleware_1.default.debug(`[KeepAlive] Context alive for ${key} — no action needed`);
            }
            catch (err) {
                logger_middleware_1.default.warn(`[KeepAlive] Error for ${key}: ${err.message}`);
            }
        }, KEEP_ALIVE_INTERVAL);
        this.keepAliveTimers.set(key, timer);
        logger_middleware_1.default.info(`[KeepAlive] Timer started for ${key} (check every ${KEEP_ALIVE_INTERVAL / 60000} min, no page visits)`);
    }
    /**
     * On server startup: scan chrome-data for existing sessions and log them.
     * NOTE: We do NOT launch browsers on startup to avoid OOM on low-memory VPS.
     * Sessions will be restored on-demand when a scrape/login is requested.
     */
    static async initializePersistentSessions() {
        logger_middleware_1.default.info('[Session Init] Scanning for existing YouTube sessions...');
        const found = [];
        if (this.hasValidSession(undefined)) {
            found.push(undefined);
        }
        if (fs_1.default.existsSync(CHROME_DATA_BASE_DIR)) {
            try {
                const entries = fs_1.default.readdirSync(CHROME_DATA_BASE_DIR, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory())
                        continue;
                    const aid = entry.name;
                    if (this.hasValidSession(aid)) {
                        found.push(aid);
                    }
                }
            }
            catch (err) {
                logger_middleware_1.default.warn(`[Session Init] Error scanning sessions: ${err.message}`);
            }
        }
        if (found.length === 0) {
            logger_middleware_1.default.info('[Session Init] No existing sessions found.');
            return;
        }
        logger_middleware_1.default.info(`[Session Init] Found ${found.length} saved session(s): ${found.map((a) => a || 'default').join(', ')}.`);
        // Start keep-alive timers immediately so sessions stay alive without needing a scrape first.
        // The timer will lazily launch the browser context on first tick (not right now) to save RAM.
        for (const adminId of found) {
            this.startKeepAlive(adminId);
            logger_middleware_1.default.info(`[Session Init] Keep-alive started for ${adminId || 'default'}`);
        }
    }
    static stopKeepAlive(adminId) {
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
    static cleanStaleLockFiles(userDataDir) {
        // SAFETY: Never delete lock files from the system Chrome profile — Chrome may be running
        const sysProfile = getSystemChromeProfileDir();
        if (sysProfile && userDataDir.startsWith(sysProfile)) {
            logger_middleware_1.default.debug(`[LockClean] Skipping system Chrome profile: ${userDataDir}`);
            return;
        }
        // Check if a Chrome process is actively using this profile by reading SingletonLock
        const lockPath = path_1.default.join(userDataDir, 'SingletonLock');
        try {
            const target = fs_1.default.readlinkSync(lockPath); // SingletonLock is a symlink to hostname-pid
            const pidMatch = target.match(/-(\d+)$/);
            if (pidMatch) {
                const pid = parseInt(pidMatch[1], 10);
                try {
                    process.kill(pid, 0); // signal 0 = just check existence
                    logger_middleware_1.default.warn(`[LockClean] Chrome PID ${pid} is still running with this profile — skipping lock cleanup`);
                    return; // Chrome is alive, don't touch its locks
                }
                catch { /* PID doesn't exist — lock is stale, safe to clean */ }
            }
        }
        catch { /* lock doesn't exist or isn't a symlink — fine */ }
        const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
        for (const file of lockFiles) {
            const filePath = path_1.default.join(userDataDir, file);
            try {
                fs_1.default.lstatSync(filePath);
                fs_1.default.unlinkSync(filePath);
                logger_middleware_1.default.info(`Removed stale lock file: ${file} from ${userDataDir}`);
            }
            catch (err) {
                if (err.code !== 'ENOENT') {
                    logger_middleware_1.default.warn(`Failed to remove lock file ${file}: ${err.message}`);
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
    static getRealChromePath() {
        if (process.env.CHROME_EXECUTABLE_PATH)
            return process.env.CHROME_EXECUTABLE_PATH;
        if (process.platform === 'darwin') {
            const p = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            if (fs_1.default.existsSync(p))
                return p;
        }
        if (process.platform === 'linux') {
            for (const p of ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser']) {
                if (fs_1.default.existsSync(p))
                    return p;
            }
        }
        if (process.platform === 'win32') {
            const candidates = [
                path_1.default.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
                path_1.default.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
                path_1.default.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
            ];
            for (const p of candidates) {
                if (fs_1.default.existsSync(p))
                    return p;
            }
        }
        return null;
    }
    /** Whether CDP mode is active (real Chrome via remote debugging) */
    static isCDPMode() {
        return !!(process.env.CHROME_CDP_URL);
    }
    /**
     * Start Chrome headlessly with --remote-debugging-port for CDP scraping.
     * Called after login is verified — Chrome runs invisibly in background.
     * Session is read from user-data-dir so no re-login needed.
     */
    static async startHeadlessChrome(adminId) {
        const realChrome = this.getRealChromePath();
        if (!realChrome) {
            logger_middleware_1.default.warn('[CDP] No real Chrome found — cannot start headless Chrome');
            return false;
        }
        const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
        const CDP_PORT = 9222;
        // Kill existing CDP process first
        if (this.cdpProcess) {
            try {
                this.cdpProcess.kill('SIGTERM');
            }
            catch { /* ignore */ }
            this.cdpProcess = null;
            await new Promise(r => setTimeout(r, 1500));
        }
        // Also kill any stale Chrome holding the SingletonLock on this profile.
        // This happens when the previous cdpProcess exited (clearing this.cdpProcess) but the
        // OS process is still alive (e.g. zombie or slow to die), preventing a new Chrome from
        // using the same user-data-dir (exit code 21 = "profile already in use").
        const lockPath = path_1.default.join(CHROME_USER_DATA_DIR, 'SingletonLock');
        try {
            const target = fs_1.default.readlinkSync(lockPath);
            const pidMatch = target.match(/-(\d+)$/);
            if (pidMatch) {
                const stalePid = parseInt(pidMatch[1], 10);
                try {
                    process.kill(stalePid, 0); // check it's alive
                    logger_middleware_1.default.info(`[CDP] Killing stale Chrome PID ${stalePid} holding SingletonLock...`);
                    process.kill(stalePid, 'SIGTERM');
                    await new Promise(r => setTimeout(r, 1000));
                    // Force kill if still alive
                    try {
                        process.kill(stalePid, 'SIGKILL');
                    }
                    catch { /* already gone */ }
                    await new Promise(r => setTimeout(r, 500));
                }
                catch { /* PID already dead — safe to proceed */ }
            }
        }
        catch { /* no lock file — clean start */ }
        // Remove stale lock files after killing the old process
        const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
        for (const lf of lockFiles) {
            try {
                fs_1.default.unlinkSync(path_1.default.join(CHROME_USER_DATA_DIR, lf));
            }
            catch { /* ignore ENOENT */ }
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
        child.on('exit', (code) => {
            logger_middleware_1.default.info(`[CDP] Headless Chrome exited (code=${code})`);
            this.cdpProcess = null;
            process.env.CHROME_CDP_URL = '';
            const key = adminId || '__default__';
            this.contexts.delete(key);
        });
        // Wait for Chrome to bind the debugging port
        await new Promise(r => setTimeout(r, 2500));
        logger_middleware_1.default.info(`[CDP] Headless Chrome started (pid=${child.pid}, port=${CDP_PORT}) — no window, full stealth`);
        return true;
    }
    /**
     * Verify session by navigating to studio.youtube.com and checking the URL.
     * - If CDP Chrome is already running: reuse the existing context (no new process needed).
     * - If not: spawn a headless Chrome on port 9223 (separate from scraping port 9222).
     * Never opens a visible window.
     */
    static async openVerifyTab(adminId) {
        // If CDP Chrome is already running, use it directly — no need to spawn a second instance
        // (two Chrome processes cannot share the same user-data-dir).
        const cdpUrl = process.env.CHROME_CDP_URL;
        if (cdpUrl) {
            logger_middleware_1.default.info('[VerifyTab] CDP already running — verifying via existing context');
            return this._verifyViaContext(adminId);
        }
        // No CDP running — spawn a temporary headless Chrome on a separate port
        const realChrome = this.getRealChromePath();
        if (!realChrome) {
            logger_middleware_1.default.info('[VerifyTab] No real Chrome — falling back to Playwright verify');
            return this.closeLoginAndVerify(adminId);
        }
        const CHROME_USER_DATA_DIR = adminId
            ? path_1.default.join(CHROME_DATA_BASE_DIR, adminId)
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
        logger_middleware_1.default.info('[VerifyTab] Spawning headless Chrome on port 9223 for verification...');
        const child = spawn(realChrome, args, { stdio: 'ignore', detached: false });
        const killChild = () => { try {
            child.kill('SIGTERM');
        }
        catch { /* ignore */ } };
        try {
            await new Promise(r => setTimeout(r, 3000));
            const { chromium: pw } = require('playwright');
            const browser = await pw.connectOverCDP(`http://localhost:${VERIFY_PORT}`, { timeout: 10000 });
            const ctx = browser.contexts()[0] ?? await browser.newContext();
            const page = ctx.pages()[0] ?? await ctx.newPage();
            await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);
            const result = await this._extractVerifyResult(page, adminId);
            await browser.close().catch(() => { });
            killChild();
            return result;
        }
        catch (err) {
            logger_middleware_1.default.warn(`[VerifyTab] Spawn verify failed: ${err.message} — falling back to Playwright verify`);
            killChild();
            return this.closeLoginAndVerify(adminId);
        }
    }
    /** Verify session by reusing the existing Playwright browser context. */
    static async _verifyViaContext(adminId) {
        let page = null;
        try {
            const context = await this.getContext(true, adminId);
            page = await context.newPage();
            await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(2000);
            const result = await this._extractVerifyResult(page, adminId);
            await safeClosePage(page);
            return result;
        }
        catch (err) {
            logger_middleware_1.default.warn(`[VerifyTab] Context verify failed: ${err.message}`);
            if (page)
                await safeClosePage(page).catch(() => { });
            return { loggedIn: false };
        }
    }
    /** Extract channel/email from a Studio page and mark session accordingly. */
    static async _extractVerifyResult(page, adminId) {
        const url = page.url();
        logger_middleware_1.default.info(`[VerifyTab] URL: ${url}`);
        if (url.includes('accounts.google.com') || url.includes('signin')) {
            logger_middleware_1.default.warn('[VerifyTab] Not logged in — redirected to Google login');
            return { loggedIn: false };
        }
        const title = await page.title().catch(() => '');
        const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;
        let email;
        try {
            email = (await page.evaluate(() => {
                for (const sel of ['[aria-label*="@"]', '[title*="@"]', 'button[aria-label*="Google"]']) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
                        const match = label.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
                        if (match)
                            return match[0];
                    }
                }
                return null;
            })) ?? undefined;
        }
        catch { /* ignore */ }
        this.markSessionVerified(adminId);
        try {
            fs_1.default.writeFileSync(getAccountInfoFile(adminId), JSON.stringify({
                channelName, email, extractedAt: new Date().toISOString(),
            }, null, 2));
        }
        catch { /* ignore */ }
        logger_middleware_1.default.info(`[VerifyTab] Session verified! Channel: ${channelName}, Email: ${email || 'unknown'}`);
        return { loggedIn: true, channelName, email };
    }
    static async getContext(_headless = true, adminId) {
        const key = adminId || '__default__';
        // Reuse existing context if still open
        const existing = this.contexts.get(key);
        if (existing) {
            try {
                void existing.pages(); // just check context is still alive (sync check)
                return existing;
            }
            catch {
                this.contexts.delete(key);
            }
        }
        // ── CDP MODE: connect to real Chrome via remote debugging ──
        const cdpUrl = process.env.CHROME_CDP_URL;
        if (cdpUrl) {
            logger_middleware_1.default.info(`[CDP] Connecting to real Chrome at ${cdpUrl}...`);
            try {
                const { chromium: pw } = require('playwright');
                const browser = await pw.connectOverCDP(cdpUrl, { timeout: 15000 });
                const contexts = browser.contexts();
                const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
                context.on('close', () => {
                    this.contexts.delete(key);
                    this.stopKeepAlive(adminId);
                    logger_middleware_1.default.warn('[CDP] Chrome context closed — reconnect on next request');
                });
                this.contexts.set(key, context);
                this.startKeepAlive(adminId);
                // Patch navigator.webdriver so Google cannot detect automation
                await context.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                }).catch(() => { });
                logger_middleware_1.default.info('[CDP] Connected to real Chrome — session is native, no detection risk');
                // Inject pending cookies (saved by importCookies) — same as auto-CDP path
                const pendingFile = getPendingCookiesFile(adminId);
                if (fs_1.default.existsSync(pendingFile)) {
                    try {
                        const pending = JSON.parse(fs_1.default.readFileSync(pendingFile, 'utf-8'));
                        await context.addCookies(pending);
                        fs_1.default.unlinkSync(pendingFile);
                        logger_middleware_1.default.info(`[CDP] Injected ${pending.length} pending cookies into ${cdpUrl}`);
                    }
                    catch (cookieErr) {
                        logger_middleware_1.default.warn(`[CDP] Failed to inject pending cookies: ${cookieErr.message}`);
                    }
                }
                return context;
            }
            catch (err) {
                throw new Error(`[CDP] Cannot connect to Chrome at ${cdpUrl}. ` +
                    `Make sure Chrome is running: use "Mở trình duyệt" to launch it. Error: ${err.message}`);
            }
        }
        // ── REAL CHROME via CDP (auto-start headless Chrome, then connect) ──
        // launchPersistentContext with real Chrome is broken (--remote-debugging-pipe incompatibility).
        // Instead: spawn Chrome directly with --headless=new --remote-debugging-port, then connectOverCDP.
        const realChromePath = this.getRealChromePath();
        if (realChromePath) {
            logger_middleware_1.default.info(`[Context] Real Chrome found — auto-starting headless CDP for admin ${adminId || 'default'}...`);
            const started = await this.startHeadlessChrome(adminId);
            if (started) {
                const autoCdpUrl = process.env.CHROME_CDP_URL;
                if (autoCdpUrl) {
                    try {
                        const { chromium: pw } = require('playwright');
                        const browser = await pw.connectOverCDP(autoCdpUrl, { timeout: 15000 });
                        const contexts = browser.contexts();
                        const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
                        context.on('close', () => {
                            this.contexts.delete(key);
                            this.stopKeepAlive(adminId);
                            logger_middleware_1.default.warn('[CDP] Chrome context closed — will restart on next request');
                        });
                        this.contexts.set(key, context);
                        this.startKeepAlive(adminId);
                        // Patch navigator.webdriver so Google cannot detect automation
                        await context.addInitScript(() => {
                            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                        }).catch(() => { });
                        logger_middleware_1.default.info('[CDP] Auto-connected to headless real Chrome via CDP');
                        // Inject pending cookies (saved by importCookies) into real Chrome via CDP.
                        // This is necessary because Playwright Chromium and Google Chrome use different
                        // cookie encryption keys — cookies written by one cannot be read by the other.
                        const pendingFile = getPendingCookiesFile(adminId);
                        if (fs_1.default.existsSync(pendingFile)) {
                            try {
                                const pending = JSON.parse(fs_1.default.readFileSync(pendingFile, 'utf-8'));
                                await context.addCookies(pending);
                                fs_1.default.unlinkSync(pendingFile);
                                logger_middleware_1.default.info(`[CDP] Injected ${pending.length} pending cookies into real Chrome`);
                            }
                            catch (cookieErr) {
                                logger_middleware_1.default.warn(`[CDP] Failed to inject pending cookies: ${cookieErr.message}`);
                            }
                        }
                        return context;
                    }
                    catch (err) {
                        logger_middleware_1.default.warn(`[CDP] Auto-connect failed: ${err.message} — killing CDP Chrome before Playwright fallback`);
                        // Kill the CDP Chrome process before Playwright uses the same profile
                        if (this.cdpProcess) {
                            try {
                                this.cdpProcess.kill('SIGTERM');
                            }
                            catch { /* ignore */ }
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
        fs_1.default.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });
        logger_middleware_1.default.info(`Launching Playwright Chromium for admin ${adminId || 'default'}...`);
        const context = await playwright_1.chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
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
            window.chrome = { runtime: {}, loadTimes: () => { }, csi: () => { }, app: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['vi-VN', 'vi', 'en-US', 'en'] });
            try {
                const originalQuery = window.navigator.permissions.query.bind(navigator.permissions);
                navigator.permissions.query = (parameters) => parameters.name === 'notifications'
                    ? Promise.resolve({ state: (typeof Notification !== 'undefined' ? Notification.permission : 'default') })
                    : originalQuery(parameters);
            }
            catch { /* ignore */ }
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
    static async closeBrowser(adminId) {
        // Kill raw login Chromium process if running
        if (this.loginProcess) {
            try {
                this.loginProcess.kill('SIGTERM');
                logger_middleware_1.default.info('Raw login Chromium process killed');
            }
            catch { /* ignore */ }
            this.loginProcess = null;
        }
        // Kill VNC/noVNC processes if running
        try {
            const { execSync } = require('child_process');
            execSync('pkill -f x11vnc; pkill -f websockify', { stdio: 'ignore' });
            logger_middleware_1.default.info('VNC/noVNC processes stopped');
        }
        catch { /* ignore */ }
        const key = adminId || '__default__';
        if (adminId) {
            this.loginBrowserOpenMap.delete(adminId);
        }
        else {
            this.loginBrowserOpen = false;
        }
        this.stopKeepAlive(adminId);
        const context = this.contexts.get(key);
        if (context) {
            try {
                await context.close();
            }
            catch { /* ignore */ }
            this.contexts.delete(key);
        }
    }
    /**
     * Reset session: close browser and delete the saved Chrome profile/session data
     */
    static async resetSession(adminId) {
        await this.closeBrowser(adminId);
        const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
        if (!fs_1.default.existsSync(CHROME_USER_DATA_DIR))
            return;
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        let lastError;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                await sleep(attempt * 500);
                fs_1.default.rmSync(CHROME_USER_DATA_DIR, { recursive: true, force: true });
                logger_middleware_1.default.info('Chrome session data deleted.');
                return;
            }
            catch (err) {
                lastError = err;
                logger_middleware_1.default.warn(`Attempt ${attempt} to delete chrome-data failed, retrying...`);
            }
        }
        throw lastError;
    }
    // ============================================================
    // LOGIN BROWSER (headful via VNC) — RAW Chromium (no Playwright automation flags)
    // ============================================================
    /** Track the raw Chromium child process used for login */
    static loginProcess = null;
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
    static async openLoginBrowser(adminId) {
        try {
            // Close any existing Playwright/CDP context AND any lingering Chrome processes
            await this.closeBrowser(adminId);
            if (this.cdpProcess) {
                try {
                    this.cdpProcess.kill('SIGTERM');
                }
                catch { /* ignore */ }
                this.cdpProcess = null;
                process.env.CHROME_CDP_URL = '';
                await new Promise(r => setTimeout(r, 1000));
            }
            if (adminId) {
                this.loginBrowserOpenMap.set(adminId, true);
            }
            else {
                this.loginBrowserOpen = true;
            }
            const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
            this.cleanStaleLockFiles(CHROME_USER_DATA_DIR);
            fs_1.default.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });
            // Prefer real Chrome (macOS/Linux), fall back to bundled Chromium
            const realChrome = this.getRealChromePath();
            const chromiumPath = realChrome || process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium';
            const isRealChrome = !!realChrome;
            logger_middleware_1.default.info(`[Login] Using browser: ${chromiumPath} (real Chrome: ${isRealChrome})`);
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
            child.on('exit', (code) => {
                logger_middleware_1.default.info(`Login Chromium exited (code=${code}) for admin ${adminId || 'default'}`);
                this.loginProcess = null;
                if (adminId) {
                    this.loginBrowserOpenMap.delete(adminId);
                }
                else {
                    this.loginBrowserOpen = false;
                }
                // Only auto-mark verified if NOT currently being verified by closeLoginAndVerify
                // (to avoid brief false positives before proper Playwright verification)
                if (!this.verifyingSession) {
                    if (fs_1.default.existsSync(path_1.default.join(CHROME_USER_DATA_DIR, 'Default', 'Cookies')) ||
                        fs_1.default.existsSync(path_1.default.join(CHROME_USER_DATA_DIR, 'Default', 'Local State'))) {
                        this.markSessionVerified(adminId);
                        logger_middleware_1.default.info(`Session marked as verified for admin ${adminId || 'default'} after browser closed.`);
                    }
                }
            });
            child.on('error', (err) => {
                logger_middleware_1.default.error(`Login Chromium spawn error: ${err.message}`);
                this.loginProcess = null;
                if (adminId) {
                    this.loginBrowserOpenMap.delete(adminId);
                }
                else {
                    this.loginBrowserOpen = false;
                }
            });
            this.loginOpenedAtMap.set(adminId || '__default__', Date.now());
            logger_middleware_1.default.info(`Opened RAW Chromium (no automation flags) for login (admin: ${adminId || 'default'}, pid: ${child.pid}).`);
            // Start x11vnc + noVNC so user can see and control Chrome via web browser
            try {
                const xDisplay = process.env.DISPLAY || ':99';
                logger_middleware_1.default.info(`Starting VNC on display ${xDisplay}`);
                exec('pkill -f x11vnc; pkill -f websockify', () => {
                    exec(`x11vnc -display ${xDisplay} -nopw -listen 0.0.0.0 -xkb -ncache 10 -forever -shared &`, (err) => {
                        if (err) {
                            logger_middleware_1.default.warn(`Failed to start x11vnc: ${err.message}`);
                        }
                        else {
                            logger_middleware_1.default.info(`x11vnc started on :5900 (sharing Xvfb display ${xDisplay})`);
                        }
                    });
                    setTimeout(() => {
                        exec('websockify --web /usr/share/novnc 6080 localhost:5900 &', (err) => {
                            if (err) {
                                logger_middleware_1.default.warn(`Failed to start noVNC: ${err.message}`);
                            }
                            else {
                                logger_middleware_1.default.info('noVNC started on port 6080');
                            }
                        });
                    }, 1000);
                });
            }
            catch (err) {
                logger_middleware_1.default.warn(`noVNC not available: ${err.message}`);
            }
            return {
                message: 'Browser da mo (khong co automation flags). Truy cap VNC de dang nhap YouTube Studio.',
                vncUrl: 'http://46.62.170.132:6080/vnc.html',
            };
        }
        catch (error) {
            if (adminId) {
                this.loginBrowserOpenMap.delete(adminId);
            }
            else {
                this.loginBrowserOpen = false;
            }
            logger_middleware_1.default.error('Failed to open login browser:', error);
            throw error;
        }
    }
    // ============================================================
    // ACCOUNT INFO & LOGIN STATUS
    // ============================================================
    /**
     * Extract account info from YouTube Studio page and cache to file.
     */
    static async extractAndCacheAccountInfo(adminId) {
        const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
        const isLoginOpen = adminId
            ? this.loginBrowserOpenMap.get(adminId)
            : this.loginBrowserOpen;
        if (isLoginOpen) {
            logger_middleware_1.default.info('Skipping extractAndCacheAccountInfo — login browser is open.');
            return {};
        }
        let page = null;
        try {
            const context = await this.getContext(true, adminId);
            page = await context.newPage();
            await page.goto('https://studio.youtube.com', {
                waitUntil: 'domcontentloaded',
                timeout: 30000,
            });
            // If redirected to Google login, session is invalid
            if (page.url().includes('accounts.google.com')) {
                logger_middleware_1.default.warn('Not logged in (redirected to Google login)');
                const redirectUrl = page.url();
                const pageTitle = await page.title().catch(() => '');
                const bodySnippet = await page.evaluate(() => document.body?.innerText?.substring(0, 300)).catch(() => '');
                await safeClosePage(page);
                await this.closeBrowser(adminId);
                this.markSessionDisconnected('account_info_redirect', redirectUrl, adminId, {
                    pageTitle,
                    bodySnippet,
                    trigger: 'extractAndCacheAccountInfo',
                }).catch(() => { });
                return {};
            }
            await page.waitForTimeout(3000);
            const title = await page.title();
            const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;
            let email;
            try {
                email =
                    (await page.evaluate(() => {
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
                                if (match)
                                    return match[0];
                            }
                        }
                        return null;
                    })) ?? undefined;
            }
            catch { /* ignore */ }
            logger_middleware_1.default.info(`Account info extracted: channel="${channelName}" email="${email || 'unknown'}"`);
            this.markSessionVerified(adminId);
            const info = {
                channelName,
                email,
                extractedAt: new Date().toISOString(),
            };
            try {
                fs_1.default.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify(info, null, 2));
            }
            catch { /* ignore */ }
            await safeClosePage(page);
            return info;
        }
        catch (err) {
            logger_middleware_1.default.warn('Could not extract account info:', err.message);
            if (page)
                await safeClosePage(page);
            return {};
        }
    }
    /**
     * Check if user is logged in to YouTube Studio
     */
    static async checkLoginStatus(adminId) {
        const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);
        const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
        const isLoginOpen = adminId
            ? this.loginBrowserOpenMap.get(adminId)
            : this.loginBrowserOpen;
        if (isLoginOpen) {
            if (fs_1.default.existsSync(SESSION_VERIFIED_FILE)) {
                if (adminId) {
                    this.loginBrowserOpenMap.delete(adminId);
                }
                else {
                    this.loginBrowserOpen = false;
                }
            }
            else {
                // Login browser still open, not verified yet — report waiting
                // Do NOT auto-close: user needs time to complete Google login + 2FA via VNC
                // User clicks "Xác nhận đăng nhập" button when done
                return { loggedIn: false, loginBrowserOpen: true };
            }
        }
        const hasSession = this.hasValidSession(adminId);
        if (!hasSession) {
            // Xóa cache cũ để không hiện sai thông tin kênh
            try {
                if (fs_1.default.existsSync(ACCOUNT_INFO_FILE))
                    fs_1.default.unlinkSync(ACCOUNT_INFO_FILE);
            }
            catch { /* ignore */ }
            return { loggedIn: false };
        }
        if (fs_1.default.existsSync(ACCOUNT_INFO_FILE)) {
            try {
                const raw = fs_1.default.readFileSync(ACCOUNT_INFO_FILE, 'utf-8');
                const info = JSON.parse(raw);
                // Chỉ đọc cache — không tự navigate để tránh bot detection
                return {
                    loggedIn: true,
                    channelName: info.channelName,
                    email: info.email,
                };
            }
            catch { /* ignore */ }
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
    static async closeLoginAndVerify(adminId) {
        this.verifyingSession = true;
        const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
        try {
            // ── CDP MODE: only when CHROME_CDP_URL is explicitly set ──
            const cdpUrl = process.env.CHROME_CDP_URL;
            if (cdpUrl) {
                // Real Chrome is still running with --remote-debugging-port=9222
                // Don't kill it — just connect and verify
                if (adminId)
                    this.loginBrowserOpenMap.delete(adminId);
                else
                    this.loginBrowserOpen = false;
                logger_middleware_1.default.info('[closeLoginAndVerify] CDP mode — verifying via existing Chrome...');
                let page = null;
                try {
                    // Set CDP URL so getContext uses it
                    process.env.CHROME_CDP_URL = cdpUrl;
                    const context = await this.getContext(true, adminId);
                    page = await context.newPage();
                    await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForTimeout(2000);
                    const url = page.url();
                    if (url.includes('accounts.google.com') || url.includes('signin')) {
                        logger_middleware_1.default.warn('[closeLoginAndVerify] CDP: Not logged in');
                        process.env.CHROME_CDP_URL = '';
                        return { loggedIn: false };
                    }
                    const title = await page.title();
                    const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;
                    this.markSessionVerified(adminId);
                    const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
                    try {
                        fs_1.default.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify({ channelName, extractedAt: new Date().toISOString() }, null, 2));
                    }
                    catch { /* ignore */ }
                    logger_middleware_1.default.info(`[closeLoginAndVerify] CDP: Session verified! Channel: ${channelName}`);
                    // Kill the headed login Chrome and restart headlessly
                    if (page) {
                        await safeClosePage(page);
                        page = null;
                    }
                    const key = adminId || '__default__';
                    this.contexts.delete(key);
                    if (this.loginProcess) {
                        try {
                            this.loginProcess.kill('SIGTERM');
                        }
                        catch { /* ignore */ }
                        this.loginProcess = null;
                    }
                    await new Promise(r => setTimeout(r, 1500));
                    await this.startHeadlessChrome(adminId);
                    logger_middleware_1.default.info('[CDP] Switched to headless Chrome — browser window closed, scraping runs invisibly');
                    return { loggedIn: true, channelName };
                }
                catch (err) {
                    logger_middleware_1.default.warn(`[closeLoginAndVerify] CDP verify failed: ${err.message}`);
                    process.env.CHROME_CDP_URL = '';
                    // Fall through to Playwright verification below
                }
                finally {
                    if (page)
                        await safeClosePage(page);
                }
            }
            // ── PLAYWRIGHT MODE: kill Chrome, verify with headless Playwright ──
            if (this.loginProcess) {
                try {
                    this.loginProcess.kill('SIGTERM');
                }
                catch { /* ignore */ }
                this.loginProcess = null;
            }
            if (adminId)
                this.loginBrowserOpenMap.delete(adminId);
            else
                this.loginBrowserOpen = false;
            await new Promise((r) => setTimeout(r, 3000));
            this.cleanStaleLockFiles(CHROME_USER_DATA_DIR);
            let tempContext = null;
            let page = null;
            try {
                tempContext = await playwright_1.chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
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
                    logger_middleware_1.default.warn('[closeLoginAndVerify] Session not established — redirected to Google login');
                    // Clean up false sentinel file if exit handler created it
                    try {
                        const sf = getSessionVerifiedFile(adminId);
                        if (fs_1.default.existsSync(sf))
                            fs_1.default.unlinkSync(sf);
                    }
                    catch { /* ignore */ }
                    return { loggedIn: false };
                }
                // Session is valid!
                const title = await page.title();
                const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;
                // Extract email if possible
                let email;
                try {
                    email = (await page.evaluate(() => {
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
                                if (match)
                                    return match[0];
                            }
                        }
                        return null;
                    })) ?? undefined;
                }
                catch { /* ignore */ }
                this.markSessionVerified(adminId);
                // Cache account info
                const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
                try {
                    fs_1.default.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify({
                        channelName, email, extractedAt: new Date().toISOString(),
                    }, null, 2));
                }
                catch { /* ignore */ }
                logger_middleware_1.default.info(`[closeLoginAndVerify] Session verified! Channel: ${channelName}, Email: ${email || 'unknown'}`);
                return { loggedIn: true, channelName, email };
            }
            finally {
                if (page)
                    await safeClosePage(page);
                if (tempContext) {
                    try {
                        await tempContext.close();
                    }
                    catch { /* ignore */ }
                }
            }
        }
        catch (err) {
            logger_middleware_1.default.warn(`[closeLoginAndVerify] Error: ${err.message}`);
            return { loggedIn: false };
        }
        finally {
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
    static async syncFromChrome(cdpUrl, adminId) {
        const url = cdpUrl || process.env.CHROME_CDP_URL || 'http://127.0.0.1:9222';
        logger_middleware_1.default.info(`[SyncFromChrome] Connecting to Chrome at ${url}...`);
        const { chromium: pw } = require('playwright');
        let browser = null;
        try {
            browser = await pw.connectOverCDP(url, { timeout: 10000 });
            const contexts = browser.contexts();
            const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
            // Extract ALL cookies from Chrome (no URL filter — get everything including .google.com)
            const allCookies = await context.cookies();
            const ytCookies = allCookies.filter((c) => c.domain.includes('google.com') ||
                c.domain.includes('youtube.com') ||
                c.domain.includes('googleapis.com'));
            logger_middleware_1.default.info(`[SyncFromChrome] Got ${allCookies.length} total cookies, ${ytCookies.length} Google/YouTube cookies`);
            if (ytCookies.length === 0) {
                logger_middleware_1.default.warn('[SyncFromChrome] No Google/YouTube cookies found — make sure Chrome is logged in to YouTube Studio');
                return { loggedIn: false };
            }
            // Log key auth cookies for debugging (name only, not value)
            const keyNames = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID', 'LOGIN_INFO'];
            const foundKeys = ytCookies.filter((c) => keyNames.includes(c.name)).map((c) => `${c.name}(exp:${c.expires > 0 ? new Date(c.expires * 1000).toISOString().slice(0, 10) : 'session'})`);
            logger_middleware_1.default.info(`[SyncFromChrome] Key auth cookies: ${foundKeys.join(', ') || 'none'}`);
            // Disconnect from Chrome before importing (avoid lock conflicts)
            await browser.close().catch(() => { });
            browser = null;
            // Import into Playwright persistent profile
            const result = await this.importCookies(ytCookies, adminId);
            // After successful import, immediately start keep-alive so context stays warm
            if (result.loggedIn) {
                this.startKeepAlive(adminId);
                // Pre-warm context in background (don't block response)
                this.getContext(true, adminId).catch((err) => logger_middleware_1.default.warn(`[SyncFromChrome] Context pre-warm failed: ${err.message}`));
            }
            return result;
        }
        catch (err) {
            logger_middleware_1.default.error(`[SyncFromChrome] Failed: ${err.message}`);
            throw new Error(`Cannot connect to Chrome at ${url}. Make sure Chrome is running with --remote-debugging-port=9222. Error: ${err.message}`);
        }
        finally {
            if (browser)
                await browser.close().catch(() => { });
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
    static async importCookies(cookies, adminId) {
        const CHROME_USER_DATA_DIR = getChromeUserDataDir(adminId);
        const SESSION_VERIFIED_FILE = getSessionVerifiedFile(adminId);
        // Close any existing context
        await this.closeBrowser(adminId);
        // Clean stale files
        this.cleanStaleLockFiles(CHROME_USER_DATA_DIR);
        fs_1.default.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });
        let tempContext = null;
        let page = null;
        try {
            // Launch headless Playwright persistent context on the user data dir
            tempContext = await playwright_1.chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
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
                const rawExpires = c.expirationDate ?? c.expires;
                const expires = rawExpires && rawExpires > 0 ? Math.floor(rawExpires) : undefined;
                const ss = c.sameSite;
                const sameSite = ss === 'no_restriction' || ss === 'None' ? 'None'
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
            const persistentCount = playwrightCookies.filter((c) => c.expires !== undefined).length;
            logger_middleware_1.default.info(`[importCookies] Adding ${playwrightCookies.length} cookies (${persistentCount} persistent, ${playwrightCookies.length - persistentCount} session) for admin ${adminId || 'default'}...`);
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
                logger_middleware_1.default.warn('[importCookies] Session not valid — redirected to Google login');
                // Clean up invalid sentinel
                try {
                    if (fs_1.default.existsSync(SESSION_VERIFIED_FILE))
                        fs_1.default.unlinkSync(SESSION_VERIFIED_FILE);
                }
                catch { /* ignore */ }
                return { loggedIn: false };
            }
            // Success — extract account info
            const title = await page.title();
            const channelName = title.replace(/\s*-\s*YouTube Studio.*$/i, '').trim() || undefined;
            let email;
            try {
                email = (await page.evaluate(() => {
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
                            if (match)
                                return match[0];
                        }
                    }
                    return null;
                })) ?? undefined;
            }
            catch { /* ignore */ }
            this.markSessionVerified(adminId);
            // Cache account info
            const ACCOUNT_INFO_FILE = getAccountInfoFile(adminId);
            try {
                fs_1.default.writeFileSync(ACCOUNT_INFO_FILE, JSON.stringify({
                    channelName, email, extractedAt: new Date().toISOString(),
                }, null, 2));
            }
            catch { /* ignore */ }
            // Save plaintext cookies so real Chrome (CDP) can re-inject them with correct encryption.
            // Playwright Chromium and Google Chrome use different cookie encryption keys on macOS,
            // so cookies written by Playwright cannot be read by real Chrome and vice versa.
            try {
                fs_1.default.writeFileSync(getPendingCookiesFile(adminId), JSON.stringify(playwrightCookies, null, 2));
                logger_middleware_1.default.info(`[importCookies] Saved ${playwrightCookies.length} cookies for CDP Chrome to pick up`);
            }
            catch { /* ignore */ }
            logger_middleware_1.default.info(`[importCookies] Session verified! Channel: ${channelName}, Email: ${email || 'unknown'}`);
            return { loggedIn: true, channelName, email };
        }
        catch (err) {
            logger_middleware_1.default.error(`[importCookies] Error: ${err.message}`);
            return { loggedIn: false };
        }
        finally {
            if (page)
                await safeClosePage(page);
            if (tempContext) {
                try {
                    await tempContext.close();
                }
                catch { /* ignore */ }
            }
        }
    }
    // ============================================================
    // URL / CHANNEL HELPERS
    // ============================================================
    static cleanChannelId(raw) {
        let id = raw.trim();
        const qIdx = id.indexOf('?');
        if (qIdx !== -1)
            id = id.substring(0, qIdx);
        const hIdx = id.indexOf('#');
        if (hIdx !== -1)
            id = id.substring(0, hIdx);
        const urlMatch = id.match(/(?:youtube\.com\/channel\/|studio\.youtube\.com\/channel\/)([A-Za-z0-9_-]+)/);
        if (urlMatch)
            id = urlMatch[1];
        return id.trim();
    }
    static buildRevenueExploreUrl(channelId, month) {
        const cleanId = this.cleanChannelId(channelId);
        let timePeriodParam = 'time_period=minus_1_month';
        if (month) {
            const [mm, yyyy] = month.split('/');
            const year = parseInt(yyyy, 10);
            const mon = parseInt(mm, 10);
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            const minus1 = currentMonth - 1 <= 0
                ? { m: currentMonth - 1 + 12, y: currentYear - 1 }
                : { m: currentMonth - 1, y: currentYear };
            const minus2 = currentMonth - 2 <= 0
                ? { m: currentMonth - 2 + 12, y: currentYear - 1 }
                : { m: currentMonth - 2, y: currentYear };
            if (mon === minus1.m && year === minus1.y) {
                timePeriodParam = 'time_period=minus_1_month';
                logger_middleware_1.default.info(`Month ${month} matches minus_1_month — using native time period`);
            }
            else if (mon === minus2.m && year === minus2.y) {
                timePeriodParam = 'time_period=minus_2_month';
                logger_middleware_1.default.info(`Month ${month} matches minus_2_month — using native time period`);
            }
            else {
                const startDate = `${yyyy}-${mm}-01`;
                const lastDay = new Date(year, mon, 0).getDate();
                const endDate = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
                timePeriodParam = `time_period=custom&start_date=${startDate}&end_date=${endDate}`;
                logger_middleware_1.default.info(`Month ${month} doesn't match recent months — using custom date range`);
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
    static async scrapeRevenueExplore(page, channelId, month) {
        const url = this.buildRevenueExploreUrl(channelId, month);
        logger_middleware_1.default.info(`Scraping revenue explore for channel: ${channelId}${month ? ` (month: ${month})` : ''}`);
        // Navigate to blank first to reduce memory pressure
        try {
            await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 });
        }
        catch { /* ignore */ }
        // Random pre-navigation delay (1-3s) to mimic human pace
        await new Promise(r => setTimeout(r, 1000 + Math.floor(Math.random() * 2000)));
        try {
            logger_middleware_1.default.info('Navigating to revenue explore page...');
            // Use domcontentloaded instead of networkidle to avoid loading all resources
            // Short timeout (30s) — fail fast and let the caller handle retry
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            logger_middleware_1.default.info(`Page loaded, current URL: ${page.url()}`);
        }
        catch (err) {
            logger_middleware_1.default.warn(`Page load timeout/error, continuing anyway... URL: ${page.url()}`, err.message);
        }
        const currentUrl = page.url();
        if (currentUrl.includes('accounts.google.com')) {
            const bodySnippet = await page.evaluate(() => document.body?.innerText?.substring(0, 200)).catch(() => '');
            logger_middleware_1.default.warn(`[Scrape] Redirected to login for channel ${channelId}: ${currentUrl}`);
            logger_middleware_1.default.warn(`[Scrape] Page snippet: ${bodySnippet.substring(0, 200)}`);
            throw new Error('NOT_LOGGED_IN');
        }
        // Verify we actually navigated to the correct channel page
        const cleanId = this.cleanChannelId(channelId);
        if (!currentUrl.includes(cleanId) && !currentUrl.includes('about:blank')) {
            logger_middleware_1.default.warn(`Navigation failed — expected channel ${cleanId} but got: ${currentUrl}`);
            throw new Error(`NAVIGATION_FAILED: Page did not navigate to channel ${cleanId}`);
        }
        // Wait for analytics table to render
        logger_middleware_1.default.info('Waiting for analytics to render...');
        try {
            await page.waitForSelector('[role="row"], ytd-app, #page-manager', { timeout: 15000 });
            logger_middleware_1.default.info('Page ready, waiting 4s for analytics data...');
            await new Promise(r => setTimeout(r, 4000));
        }
        catch {
            logger_middleware_1.default.info('Selector timeout, using 12s fallback...');
            await new Promise(r => setTimeout(r, 12000));
        }
        // Scroll to trigger lazy-loaded elements (needed in headless mode)
        try {
            await page.evaluate('window.scrollTo(0, 400)');
            await new Promise(r => setTimeout(r, 1000));
            await page.evaluate('window.scrollTo(0, 0)');
        }
        catch { /* ignore */ }
        // Stop all background network loading to freeze RAM usage before extraction
        try {
            await page.evaluate(() => window.stop());
        }
        catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 500));
        logger_middleware_1.default.info('Extracting text...');
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
        })()`),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout extracting text (exceeded 60s)')), 60000)),
            ]);
            if (text && text.trim().length > 50)
                break;
            logger_middleware_1.default.warn(`Text extraction attempt ${attempt}: only ${text.length} chars, waiting 5s more...`);
            await new Promise(r => setTimeout(r, 5000));
        }
        // Navigate away immediately to free page memory
        try {
            await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 });
        }
        catch { /* ignore */ }
        logger_middleware_1.default.info(`Scraped revenue explore (${text.length} chars)`);
        return text;
    }
    /**
     * Scrape YouTube Studio revenue explore page for a single channel
     */
    static async scrapeAnalytics(channelId, month, adminId) {
        let page = null;
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
            logger_middleware_1.default.info(`Starting scrape for channel: ${channelId}${month ? ` (month: ${month})` : ''}`);
            const result = await this.scrapeChannelWithPage(page, channelId, month);
            return result;
        }
        finally {
            await safeClosePage(page);
        }
    }
    /**
     * Scrape multiple channels sequentially - REUSES same page for efficiency
     */
    static async scrapeMultipleChannels(channelIds, month, onProgress, adminId, channelLabels) {
        const results = [];
        const errors = [];
        const total = channelIds.length;
        // Pause KeepAlive to avoid RAM competition during batch scrape
        const scrapeKey = adminId || '__default__';
        this.scrapingInProgress.set(scrapeKey, true);
        /**
         * Helper: open fresh page → block heavy resources → scrape one channel → close page.
         * Each channel gets its OWN page so V8 heap is fully freed after every channel.
         */
        const scrapeOneChannel = async (channelId) => {
            let page = null;
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
            }
            finally {
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
            if (!existingCtx)
                return;
            try {
                const pages = existingCtx.pages();
                if (pages.length === 0)
                    return;
                // Navigate first page to blank (keep it as the "holder" page)
                try {
                    await pages[0].goto('about:blank', { waitUntil: 'commit', timeout: 3000 });
                }
                catch { /* ignore */ }
                // Close all extra pages (index 1+)
                for (let idx = 1; idx < pages.length; idx++) {
                    try {
                        await pages[idx].goto('about:blank', { waitUntil: 'commit', timeout: 2000 });
                        await pages[idx].close();
                    }
                    catch { /* ignore */ }
                }
                logger_middleware_1.default.info(`[Memory] Soft reset: navigated ${pages.length} page(s) to blank, kept 1 holder open`);
            }
            catch (err) {
                logger_middleware_1.default.warn(`[Memory] Soft reset failed: ${err.message}`);
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
                try {
                    await existingCtx.close();
                }
                catch { /* ignore */ }
                this.contexts.delete(adminId || '__default__');
            }
            try {
                const { execSync } = require('child_process');
                execSync('pkill -9 -f chromium || true', { stdio: 'ignore', timeout: 5000 });
                logger_middleware_1.default.info('Killed zombie chromium processes');
            }
            catch { /* ignore */ }
            // Allow OS to reclaim freed RAM
            await new Promise(r => setTimeout(r, 5000));
        };
        /**
         * Navigate studio.youtube.com to fully restore session from persistent profile.
         * Only needed after a cold context launch (brand-new or post-crash relaunch).
         * Skipped when context is already warm (pages from a previous request exist).
         */
        const warmUpSession = async (reason) => {
            logger_middleware_1.default.info(`Warming up browser session (${reason})...`);
            let warmPage = null;
            try {
                const context = await this.getContext(true, adminId);
                warmPage = await context.newPage();
                await warmPage.route('**/*', (route) => {
                    const type = route.request().resourceType();
                    if (['image', 'font', 'media', 'stylesheet'].includes(type))
                        return route.abort();
                    return route.continue();
                });
                await warmPage.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
                const warmUrl = warmPage.url();
                if (warmUrl.includes('accounts.google.com')) {
                    const bodySnippet = await warmPage.evaluate(() => document.body?.innerText?.substring(0, 300)).catch(() => '');
                    logger_middleware_1.default.error(`[WarmUp] Session expired — redirected to: ${warmUrl}`);
                    logger_middleware_1.default.error(`[WarmUp] Page snippet: ${bodySnippet.substring(0, 200)}`);
                    // Write to session error log immediately (scrapeAllKOCs will call markSessionDisconnected separately)
                    try {
                        const logDir = path_1.default.join(process.cwd(), 'logs', 'session-errors');
                        fs_1.default.mkdirSync(logDir, { recursive: true });
                        const now = new Date();
                        const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
                        const logFile = path_1.default.join(logDir, `${now.toISOString().substring(0, 10)}.log`);
                        fs_1.default.appendFileSync(logFile, [
                            `\n${'='.repeat(60)}`,
                            `[${dateStr}] WARMUP REDIRECT DETECTED`,
                            `  Admin   : ${adminId || 'default'}`,
                            `  Reason  : ${reason}`,
                            `  URL     : ${warmUrl}`,
                            `  Snippet : ${bodySnippet.substring(0, 300)}`,
                            '',
                        ].join('\n') + '\n');
                    }
                    catch { /* ignore */ }
                    throw new Error('NOT_LOGGED_IN');
                }
                await new Promise(r => setTimeout(r, 3000));
                await safeClosePage(warmPage);
                logger_middleware_1.default.info('Browser session warm-up complete');
            }
            catch (err) {
                if (warmPage)
                    await safeClosePage(warmPage).catch(() => { });
                if (err.message === 'NOT_LOGGED_IN')
                    throw err;
                logger_middleware_1.default.warn(`Warm-up failed (continuing anyway): ${err.message}`);
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
            }
            else {
                logger_middleware_1.default.info('Browser context already warm — skipping studio warm-up');
            }
            // Concurrency: sequential (1) for large batches to avoid Google session kill,
            // parallel (2) for small batches. Tune via env var if needed.
            const CONCURRENCY = total > 10 ? 1 : 2;
            // Delay between batches: longer for large batches to avoid rate-limiting
            const BATCH_DELAY_MS = total > 10 ? 8000 : 4000;
            // Every N batches, do a studio homepage visit to "reset" Google's request counter
            const SESSION_REFRESH_EVERY = 5;
            // Split channelIds into chunks of CONCURRENCY
            const chunks = [];
            for (let i = 0; i < channelIds.length; i += CONCURRENCY) {
                chunks.push(channelIds.slice(i, i + CONCURRENCY));
            }
            logger_middleware_1.default.info(`Starting batch scrape: ${total} channels, concurrency=${CONCURRENCY}, batchDelay=${BATCH_DELAY_MS}ms (${chunks.length} batches)${month ? ` — month ${month}` : ''}`);
            let sessionExpired = false;
            for (let batchIdx = 0; batchIdx < chunks.length; batchIdx++) {
                if (sessionExpired)
                    break;
                const chunk = chunks[batchIdx];
                const batchStart = batchIdx * CONCURRENCY;
                logger_middleware_1.default.info(`[Batch ${batchIdx + 1}/${chunks.length}] Scraping ${chunk.length} channels in parallel: ${chunk.join(', ')}`);
                // Notify progress for each channel in this batch
                chunk.forEach((channelId, idx) => {
                    if (onProgress)
                        onProgress(channelId, batchStart + idx, total);
                });
                // Run CONCURRENCY channels simultaneously
                const chunkResults = await Promise.allSettled(chunk.map(channelId => scrapeOneChannel(channelId)));
                // Collect results
                for (let j = 0; j < chunkResults.length; j++) {
                    const channelId = chunk[j];
                    const r = chunkResults[j];
                    if (r.status === 'fulfilled') {
                        results.push(r.value);
                        logger_middleware_1.default.info(`[Batch ${batchIdx + 1}] ✓ ${channelId}`);
                        this.writeKocLog(channelId, month, r.value, null, channelLabels);
                    }
                    else {
                        const errMsg = r.reason?.message || 'Unknown error';
                        errors.push({ channelId, error: errMsg });
                        logger_middleware_1.default.warn(`[Batch ${batchIdx + 1}] ✗ ${channelId}: ${errMsg}`);
                        this.writeKocLog(channelId, month, null, errMsg, channelLabels);
                        if (errMsg === 'NOT_LOGGED_IN')
                            sessionExpired = true;
                    }
                }
                if (sessionExpired) {
                    // Verify session before giving up — might be a transient redirect
                    logger_middleware_1.default.warn('NOT_LOGGED_IN detected in batch — verifying session...');
                    try {
                        await warmUpSession('session verify after NOT_LOGGED_IN');
                        logger_middleware_1.default.info('Session still valid — will retry failed channels in retry pass');
                        sessionExpired = false;
                    }
                    catch (verifyErr) {
                        if (verifyErr.message === 'NOT_LOGGED_IN') {
                            logger_middleware_1.default.error('Session truly expired — stopping scrape.');
                            const failedChannels = errors.filter(e => e.error === 'NOT_LOGGED_IN').map(e => e.channelId);
                            this.markSessionDisconnected('scrape_not_logged_in', undefined, adminId, {
                                trigger: 'scrapeAllKOCs',
                                batchIdx: String(batchIdx),
                                totalBatches: String(chunks.length),
                                failedChannels: failedChannels.join(', '),
                                verifyError: verifyErr.message,
                            }).catch(() => { });
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
                        logger_middleware_1.default.info(`[Session] Refreshing session after batch ${batchIdx + 1} to avoid rate-limit...`);
                        try {
                            await warmUpSession(`periodic refresh after ${batchIdx + 1} batches`);
                        }
                        catch { /* ignore — scrape continues */ }
                    }
                    // Random delay: base + jitter to mimic human behavior
                    const jitter = Math.floor(Math.random() * 3000);
                    const delay = BATCH_DELAY_MS + jitter;
                    logger_middleware_1.default.info(`[Throttle] Waiting ${delay}ms before next batch...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
            // ── RETRY PASS: retry failed channels once (skip NOT_LOGGED_IN) ──
            const retryableErrors = errors.filter(e => !e.error.includes('NOT_LOGGED_IN'));
            if (retryableErrors.length > 0) {
                const failedChannels = retryableErrors.map(e => e.channelId);
                logger_middleware_1.default.info(`🔄 Retrying ${failedChannels.length} failed channel(s)...`);
                for (let i = 0; i < failedChannels.length; i++) {
                    const channelId = failedChannels[i];
                    try {
                        logger_middleware_1.default.info(`[Retry ${i + 1}/${failedChannels.length}] Channel: ${channelId}`);
                        const data = await scrapeOneChannel(channelId);
                        results.push(data);
                        const errIdx = errors.findIndex(e => e.channelId === channelId);
                        if (errIdx >= 0)
                            errors.splice(errIdx, 1);
                        logger_middleware_1.default.info(`[Retry ${i + 1}/${failedChannels.length}] ✓ Recovered`);
                        if (i < failedChannels.length - 1) {
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }
                    catch (retryErr) {
                        logger_middleware_1.default.warn(`[Retry ${i + 1}/${failedChannels.length}] ✗ Still failed: ${retryErr.message}`);
                        const isCrash = retryErr.message?.includes('Target crashed') ||
                            retryErr.message?.includes('Target closed') ||
                            retryErr.message?.includes('SCRAPE_TIMEOUT');
                        if (isCrash)
                            await resetContext();
                    }
                }
                const recovered = failedChannels.length - errors.filter(e => !e.error.includes('NOT_LOGGED_IN')).length;
                logger_middleware_1.default.info(`🔄 Retry done: ${recovered} recovered`);
            }
            logger_middleware_1.default.info(`Batch complete: ${results.length} success, ${errors.length} failed`);
            if (results.length > 0) {
                this.markSessionVerified(adminId);
                logger_middleware_1.default.info(`Session verified after batch scrape for admin ${adminId || 'default'}`);
            }
            return { results, errors };
        }
        finally {
            // Soft-reset context to free renderer memory BEFORE next request
            // This is critical when client sends 1-channel requests sequentially:
            // without this, Chromium accumulates RAM across requests → OOM after 4-5 channels
            try {
                await softReset();
                logger_middleware_1.default.info('[Memory] Post-batch soft reset done — context ready for next request');
            }
            catch (rErr) {
                logger_middleware_1.default.warn(`[Memory] Post-batch soft reset failed (non-fatal): ${rErr.message}`);
            }
            // Resume KeepAlive
            this.scrapingInProgress.set(scrapeKey, false);
            logger_middleware_1.default.debug('Batch scrape complete. Persistent context kept alive for next scrape.');
        }
    }
    // ============================================================
    // PRIVATE HELPERS
    // ============================================================
    /**
     * Core scraping logic - uses provided page (reusable for batch operations)
     */
    static async scrapeChannelWithPage(page, channelId, month) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('SCRAPE_TIMEOUT: Exceeded 90 seconds')), 90000);
        });
        const scrapePromise = (async () => {
            try {
                const rawText = await this.scrapeRevenueExplore(page, channelId, month);
                const parsed = this.parseRevenueExploreText(rawText);
                const result = {
                    channelId,
                    totals: parsed.totals,
                    countries: parsed.countries,
                    period: parsed.period,
                    rawText,
                    scrapedAt: new Date().toISOString(),
                };
                logger_middleware_1.default.info(`Successfully scraped revenue explore for channel: ${channelId}`, {
                    revenue: parsed.totals.estimatedRevenue,
                    views: parsed.totals.views,
                    countries: parsed.countries.length,
                });
                return result;
            }
            catch (error) {
                if (error.message === 'NOT_LOGGED_IN') {
                    logger_middleware_1.default.warn('Not logged in to YouTube Studio');
                    throw new Error('NOT_LOGGED_IN');
                }
                if (error.message?.includes('SCRAPE_TIMEOUT')) {
                    logger_middleware_1.default.error(`Timeout scraping ${channelId}`);
                    throw new Error('SCRAPE_TIMEOUT');
                }
                logger_middleware_1.default.error(`Failed to scrape analytics for ${channelId}:`, error);
                throw error;
            }
        })();
        return Promise.race([scrapePromise, timeoutPromise]);
    }
    // ============================================================
    // PARSING (identical to Puppeteer version)
    // ============================================================
    static parseRevenueExploreText(text) {
        const totals = {
            estimatedRevenue: null,
            views: null,
            watchTimeHours: null,
            avgWatchTime: null,
        };
        const countries = [];
        let period = '';
        const logPath = null;
        let logContent = `=== REVENUE PARSING LOG ===\nTime: ${new Date().toISOString()}\n\n`;
        try {
            const lines = text
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);
            logContent += `Total lines in text: ${lines.length}\n\n`;
            logContent += `=== RAW TEXT ===\n${lines.join('\n')}\n\n=== PARSING ===\n`;
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
            let inTable = false;
            let foundTotal = false;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (/^Địa lý$|^Geography$/i.test(line) ||
                    /Doanh thu ước tính|Estimated revenue/i.test(line)) {
                    inTable = true;
                    continue;
                }
                if (!inTable)
                    continue;
                if (/^Tổng$|^Total$/i.test(line) && !foundTotal) {
                    foundTotal = true;
                    logContent += `\nFOUND TOTAL ROW at line ${i}\n`;
                    logContent += `Next lines for extraction:\n`;
                    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
                        logContent += `  [${j}]: "${lines[j]}"\n`;
                    }
                    const rowValues = this.extractTableRowValues(lines, i + 1, 4);
                    logContent += `\nExtracted values: [${rowValues.map((v) => `"${v}"`).join(', ')}] (count: ${rowValues.length})\n`;
                    logger_middleware_1.default.info(`TOTAL ROW - Raw values: [${rowValues.join(', ')}]`);
                    if (rowValues.length >= 1) {
                        const revParsed = this.parseRevenueValue(rowValues[0]);
                        totals.estimatedRevenue = revParsed;
                        logContent += `  [0] "${rowValues[0]}" -> Revenue = ${revParsed}\n`;
                        logger_middleware_1.default.info(`   [Total] Revenue field: "${rowValues[0]}" -> ${totals.estimatedRevenue}`);
                    }
                    if (rowValues.length >= 2) {
                        const viewsParsed = this.parseIntegerValue(rowValues[1]);
                        totals.views = viewsParsed;
                        logContent += `  [1] "${rowValues[1]}" -> Views = ${viewsParsed}\n`;
                        logger_middleware_1.default.info(`   [Total] Views field: "${rowValues[1]}" -> ${totals.views}`);
                    }
                    if (rowValues.length >= 3) {
                        const wtParsed = this.parseDecimalValue(rowValues[2]);
                        totals.watchTimeHours = wtParsed;
                        logContent += `  [2] "${rowValues[2]}" -> WatchTime = ${wtParsed}\n`;
                        logger_middleware_1.default.info(`   [Total] WatchTime field: "${rowValues[2]}" -> ${totals.watchTimeHours}`);
                    }
                    if (rowValues.length >= 4) {
                        totals.avgWatchTime = this.parseTimeValue(rowValues[3]);
                        logContent += `  [3] "${rowValues[3]}" -> AvgTime = ${totals.avgWatchTime}\n`;
                    }
                    logContent += `\nFinal totals: revenue=${totals.estimatedRevenue}, views=${totals.views}, watchTime=${totals.watchTimeHours}\n`;
                    logger_middleware_1.default.info(`   [Total] Final: revenue=${totals.estimatedRevenue}, views=${totals.views}`);
                    continue;
                }
                if (foundTotal) {
                    if (this.isCountryName(line)) {
                        const country = line;
                        const rowValues = this.extractTableRowValues(lines, i + 1, 8);
                        logContent += `\nCountry: ${country}\n`;
                        logContent += `  Raw values: [${rowValues.map((v) => `"${v}"`).join(', ')}]\n`;
                        logger_middleware_1.default.info(`Parsing country: ${country}`);
                        logger_middleware_1.default.info(`   Raw values: [${rowValues.join(', ')}]`);
                        const countryData = {
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
                            logger_middleware_1.default.debug(`   [v=${v}, idx=${valueIdx}] Processing: "${val}"`);
                            if (valueIdx === 0) {
                                if (val === '-') {
                                    countryData.estimatedRevenue = 0;
                                    valueIdx = 2;
                                    logger_middleware_1.default.debug('     -> Revenue = 0 (dash), skip to idx=2');
                                }
                                else if (/\$/.test(val) || /₫/.test(val)) {
                                    countryData.estimatedRevenue = this.parseRevenueValue(val);
                                    valueIdx = 1;
                                    logger_middleware_1.default.debug(`     -> Revenue = ${countryData.estimatedRevenue}, move to idx=1`);
                                }
                                else if (/^[\d.,]+$/.test(val)) {
                                    countryData.estimatedRevenue = 0;
                                    countryData.views = this.parseIntegerValue(val);
                                    valueIdx = 3;
                                    logger_middleware_1.default.debug(`     -> No $ sign: Revenue = 0, Views = ${countryData.views}, move to idx=3`);
                                }
                            }
                            else if (valueIdx === 1 && /%/.test(val)) {
                                countryData.revenuePercent = this.parsePercentValue(val);
                                valueIdx = 2;
                                logger_middleware_1.default.debug(`     -> RevenuePercent = ${countryData.revenuePercent}, move to idx=2`);
                            }
                            else if (valueIdx === 2 && /^[\d.,]+$/.test(val)) {
                                countryData.views = this.parseIntegerValue(val);
                                valueIdx = 3;
                                logger_middleware_1.default.debug(`     -> Views = ${countryData.views}, move to idx=3`);
                            }
                            else if (valueIdx === 3 && /%/.test(val)) {
                                countryData.viewsPercent = this.parsePercentValue(val);
                                valueIdx = 4;
                                logger_middleware_1.default.debug(`     -> ViewsPercent = ${countryData.viewsPercent}, move to idx=4`);
                            }
                            else if (valueIdx === 4 && /^[\d.,]+$/.test(val)) {
                                countryData.watchTimeHours = this.parseDecimalValue(val);
                                valueIdx = 5;
                                logger_middleware_1.default.debug(`     -> WatchTimeHours = ${countryData.watchTimeHours}, move to idx=5`);
                            }
                            else if (valueIdx === 5 && /%/.test(val)) {
                                countryData.watchTimePercent = this.parsePercentValue(val);
                                valueIdx = 6;
                                logger_middleware_1.default.debug(`     -> WatchTimePercent = ${countryData.watchTimePercent}, move to idx=6`);
                            }
                            else if (valueIdx >= 6 &&
                                /^\d{1,2}:\d{2}$/.test(val)) {
                                countryData.avgWatchTime = val;
                                valueIdx = 7;
                                logger_middleware_1.default.debug(`     -> AvgWatchTime = ${countryData.avgWatchTime}, move to idx=7`);
                            }
                            else if (valueIdx === 1 && /^[\d.,]+$/.test(val)) {
                                countryData.views = this.parseIntegerValue(val);
                                valueIdx = 3;
                                logger_middleware_1.default.debug(`     -> No % after revenue: Views = ${countryData.views}, move to idx=3`);
                            }
                            else if (valueIdx === 2 &&
                                /^\d{1,2}:\d{2}$/.test(val)) {
                                countryData.avgWatchTime = val;
                                valueIdx = 7;
                                logger_middleware_1.default.debug(`     -> Direct to time: AvgWatchTime = ${countryData.avgWatchTime}, move to idx=7`);
                            }
                        }
                        logger_middleware_1.default.info(`   Final: revenue=${countryData.estimatedRevenue}, views=${countryData.views}, watchTime=${countryData.watchTimeHours}`);
                        logContent += `  Result: revenue=${countryData.estimatedRevenue}, views=${countryData.views}, watchTime=${countryData.watchTimeHours}\n`;
                        if (countryData.estimatedRevenue !== null ||
                            countryData.views !== null) {
                            countries.push(countryData);
                        }
                    }
                    if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode/i.test(line)) {
                        break;
                    }
                }
            }
        }
        catch (err) {
            logger_middleware_1.default.error('Error parsing revenue explore text:', err);
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
                fs_1.default.writeFileSync(logPath, logContent, 'utf-8');
            }
            catch { /* ignore */ }
        }
        return { totals, countries, period };
    }
    static extractTableRowValues(lines, startIdx, maxValues) {
        const values = [];
        for (let i = startIdx; i < Math.min(startIdx + maxValues + 5, lines.length); i++) {
            const line = lines[i];
            if (this.isCountryName(line) ||
                /^(Tổng|Total|Địa lý|Geography)$/i.test(line))
                break;
            if (line === '-' ||
                line === '—' ||
                (/[\d$%:₫]/.test(line) && line.length < 30)) {
                values.push(line);
                logger_middleware_1.default.debug(`       [extractTableRowValues] Found: "${line}"`);
                if (values.length >= maxValues)
                    break;
            }
        }
        return values;
    }
    static isCountryName(line) {
        if (!line || line.length < 2 || line.length > 50)
            return false;
        if (/^[\d$%+\-₫]/.test(line))
            return false;
        if (/^\d{1,2}:\d{2}$/.test(line))
            return false;
        if (/^[A-ZÀ-Ỹ][a-zà-ỹ]/.test(line) &&
            !/\$|₫|%|giờ|hour|xem|view|thu|revenue/i.test(line))
            return true;
        return false;
    }
    static parseRevenueValue(str) {
        if (!str || str === '-' || str === '—')
            return 0;
        if (str.includes('₫')) {
            const vndCleaned = str.replace(/[₫\s]/g, '');
            if (!vndCleaned)
                return 0;
            const vndAmount = this.parseNumber(vndCleaned);
            if (isNaN(vndAmount) || vndAmount === 0)
                return 0;
            const usdAmount = exchange_rate_service_1.ExchangeRateService.convertVndToUsd(vndAmount);
            if (usdAmount !== null) {
                logger_middleware_1.default.debug(`VND->USD: ${str} (${vndAmount} VND) = ${usdAmount} USD`);
            }
            return usdAmount ?? 0;
        }
        const cleaned = str.replace(/[$\s]/g, '');
        if (!cleaned)
            return 0;
        const num = this.parseNumber(cleaned);
        return isNaN(num) ? 0 : num;
    }
    static parsePercentValue(str) {
        if (!str)
            return null;
        const cleaned = str.replace(/%/g, '').trim();
        if (!cleaned)
            return null;
        const num = this.parseNumber(cleaned);
        return isNaN(num) ? null : num;
    }
    static parseIntegerValue(str) {
        if (!str)
            return null;
        const cleaned = this.normalizeNumber(str);
        const num = parseInt(cleaned, 10);
        return isNaN(num) ? null : num;
    }
    static parseDecimalValue(str) {
        if (!str)
            return null;
        const num = this.parseNumber(str);
        return num || null;
    }
    static parseTimeValue(str) {
        if (!str)
            return null;
        const match = str.match(/(\d{1,2}:\d{2})/);
        return match ? match[1] : null;
    }
    static normalizeNumber(str) {
        let cleaned = str.trim();
        if (cleaned.includes(',')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        }
        else if (cleaned.includes('.')) {
            const parts = cleaned.split('.');
            if (parts.length > 2 || (parts[1] && parts[1].length > 2)) {
                cleaned = cleaned.replace(/\./g, '');
            }
        }
        return cleaned;
    }
    static parseNumber(str) {
        if (!str)
            return 0;
        const cleaned = this.normalizeNumber(str);
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : Math.round(num * 1000000) / 1000000;
    }
}
exports.YouTubeScraperService = YouTubeScraperService;
//# sourceMappingURL=youtube-scraper.service.js.map