import { BrowserContext } from 'playwright';
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
    /** Period label (e.g. "Tháng 1") */
    period: string;
    /** Raw page text for debugging */
    rawText?: string;
    scrapedAt: string;
}
export declare class YouTubeScraperService {
    /**
     * Per-admin persistent browser contexts.
     * Playwright's launchPersistentContext() = Browser + userDataDir + full state
     * (cookies, localStorage, IndexedDB). No manual cookie save/load needed.
     */
    private static contexts;
    /** Per-admin login browser open flags */
    private static loginBrowserOpenMap;
    /** Legacy flag */
    private static loginBrowserOpen;
    /** Throttle session-expired email alerts — track last sent time per adminId */
    private static lastAlertSentAt;
    /** Per-admin session verified timestamps */
    private static sessionVerifiedAtMap;
    /** Per-admin keep-alive interval timers */
    private static keepAliveTimers;
    /** Per-admin last real session verification timestamp */
    private static lastRealVerifyMap;
    /** Track when login browser was opened (per admin) */
    private static loginOpenedAtMap;
    /** Flag to prevent concurrent session verifications */
    private static verifyingSession;
    /** Track the headless Chrome CDP process */
    private static cdpProcess;
    /** Flag to pause KeepAlive during batch scraping */
    private static scrapingInProgress;
    /** Used by other services (e.g. exchange rate) to avoid launching concurrent Chromium instances */
    static isAnyScrapingActive(): boolean;
    /** Write per-KOC scrape log to src/logs/{label}_{month}.log */
    private static writeKocLog;
    /**
     * Check if session exists without opening browser
     */
    static hasValidSession(adminId?: string): boolean;
    /**
     * Record disconnect reason to DB so UI can show detailed error
     */
    static markSessionDisconnected(reason: string, url?: string, adminId?: string, extra?: Record<string, unknown>): Promise<void>;
    /**
     * Send session-expired email alert to admin — throttled to once per hour
     */
    private static notifySessionExpired;
    /**
     * Write the session-verified sentinel file to mark a confirmed login
     */
    private static markSessionVerified;
    private static getEncryptionKey;
    static encryptPassword(plaintext: string): string;
    static decryptPassword(encryptedText: string): string;
    /**
     * Keep-alive: chỉ kiểm tra context còn sống không, KHÔNG navigate thêm trang.
     * Tránh gửi request đều đặn đến Google (dễ bị bot detection).
     * Context Playwright persistent tự refresh OAuth token nội bộ khi còn trong memory.
     * Navigate thực sự chỉ xảy ra khi scrape — đó là hành vi tự nhiên nhất.
     */
    private static startKeepAlive;
    /**
     * On server startup: scan chrome-data for existing sessions and log them.
     * NOTE: We do NOT launch browsers on startup to avoid OOM on low-memory VPS.
     * Sessions will be restored on-demand when a scrape/login is requested.
     */
    static initializePersistentSessions(): Promise<void>;
    private static stopKeepAlive;
    /**
     * Remove stale Chrome lock files that prevent browser launch
     */
    private static cleanStaleLockFiles;
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
    static getRealChromePath(): string | null;
    /** Whether CDP mode is active (real Chrome via remote debugging) */
    static isCDPMode(): boolean;
    /**
     * Start Chrome headlessly with --remote-debugging-port for CDP scraping.
     * Called after login is verified — Chrome runs invisibly in background.
     * Session is read from user-data-dir so no re-login needed.
     */
    static startHeadlessChrome(adminId?: string): Promise<boolean>;
    /**
     * Verify session by navigating to studio.youtube.com and checking the URL.
     * - If CDP Chrome is already running: reuse the existing context (no new process needed).
     * - If not: spawn a headless Chrome on port 9223 (separate from scraping port 9222).
     * Never opens a visible window.
     */
    static openVerifyTab(adminId?: string): Promise<{
        loggedIn: boolean;
        channelName?: string;
        email?: string;
    }>;
    /** Verify session by reusing the existing Playwright browser context. */
    private static _verifyViaContext;
    /** Extract channel/email from a Studio page and mark session accordingly. */
    private static _extractVerifyResult;
    static getContext(_headless?: boolean, adminId?: string): Promise<BrowserContext>;
    /**
     * Close the browser context (and raw login Chromium if running)
     */
    static closeBrowser(adminId?: string): Promise<void>;
    /**
     * Reset session: close browser and delete the saved Chrome profile/session data
     */
    static resetSession(adminId?: string): Promise<void>;
    /** Track the raw Chromium child process used for login */
    private static loginProcess;
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
    static openLoginBrowser(adminId?: string): Promise<{
        message: string;
        vncUrl?: string;
    }>;
    /**
     * Extract account info from YouTube Studio page and cache to file.
     */
    static extractAndCacheAccountInfo(adminId?: string): Promise<{
        channelName?: string;
        email?: string;
    }>;
    /**
     * Check if user is logged in to YouTube Studio
     */
    static checkLoginStatus(adminId?: string): Promise<{
        loggedIn: boolean;
        channelName?: string;
        email?: string;
        loginBrowserOpen?: boolean;
    }>;
    /**
     * Close the raw login Chromium and verify the session with headless Playwright.
     * Used automatically by checkLoginStatus after 30s, or manually via verify-session endpoint.
     */
    static closeLoginAndVerify(adminId?: string): Promise<{
        loggedIn: boolean;
        channelName?: string;
        email?: string;
        loginBrowserOpen?: boolean;
    }>;
    /**
     * Auto-sync cookies from a running Chrome instance (via CDP).
     * Requires Chrome to be open with --remote-debugging-port=9222 and logged in to YouTube Studio.
     * No browser extension needed — server reads cookies directly via Playwright CDP.
     */
    static syncFromChrome(cdpUrl?: string, adminId?: string): Promise<{
        loggedIn: boolean;
        channelName?: string;
        email?: string;
    }>;
    /**
     * Import cookies from user's local browser to establish YouTube session.
     * User exports cookies using Chrome extension (e.g. Cookie-Editor) on studio.youtube.com,
     * then pastes the JSON here. Server writes cookies into a headless Playwright profile
     * and verifies the session works.
     *
     * Cookie format: Array of { name, value, domain, path, ... }
     */
    static importCookies(cookies: Array<{
        name: string;
        value: string;
        domain: string;
        path?: string;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: string;
        expirationDate?: number;
    }>, adminId?: string): Promise<{
        loggedIn: boolean;
        channelName?: string;
        email?: string;
    }>;
    static cleanChannelId(raw: string): string;
    private static buildRevenueExploreUrl;
    /**
     * Navigate to revenue explore page and extract page text
     */
    private static scrapeRevenueExplore;
    /**
     * Scrape YouTube Studio revenue explore page for a single channel
     */
    static scrapeAnalytics(channelId: string, month?: string, adminId?: string): Promise<YouTubeAnalyticsData>;
    /**
     * Scrape multiple channels sequentially - REUSES same page for efficiency
     */
    static scrapeMultipleChannels(channelIds: string[], month?: string, onProgress?: (channelId: string, index: number, total: number) => void, adminId?: string, channelLabels?: Map<string, string>): Promise<{
        results: YouTubeAnalyticsData[];
        errors: Array<{
            channelId: string;
            error: string;
        }>;
    }>;
    /**
     * Core scraping logic - uses provided page (reusable for batch operations)
     */
    private static scrapeChannelWithPage;
    private static parseRevenueExploreText;
    private static extractTableRowValues;
    private static isCountryName;
    private static parseRevenueValue;
    private static parsePercentValue;
    private static parseIntegerValue;
    private static parseDecimalValue;
    private static parseTimeValue;
    private static normalizeNumber;
    private static parseNumber;
}
//# sourceMappingURL=youtube-scraper.service.d.ts.map