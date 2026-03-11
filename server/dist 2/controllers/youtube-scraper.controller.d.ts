import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class YouTubeScraperController {
    /**
     * POST /api/yt-scraper/login
     * Open browser for manual Google login
     */
    static openLogin(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/yt-scraper/status
     * Check login status
     */
    static checkStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/verify-session
     * Close login browser and verify session with headless Playwright
     */
    static verifySession(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/import-cookies
     * Import cookies from user's local browser to establish YouTube session (alternative to VNC)
     */
    static importCookies(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/sync-from-chrome
     * Auto-sync cookies from local Chrome (no extension needed)
     */
    static syncFromChrome(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/scrape-all
     * Scrape analytics for all active KOCs
     */
    static scrapeAll(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Background method to scrape all channels with progress
     */
    private static runScrapeAll;
    /**
     * POST /api/yt-scraper/close
     * Close the browser instance
     */
    static closeBrowser(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/reset-session
     * Reset (delete) saved Chrome session so user can log in with a different account
     */
    static resetSession(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/refresh-account-info
     * Extract and return the connected YouTube account info (channel name, email)
     */
    static refreshAccountInfo(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/scrape-all-async
     * Start async batch scrape job (returns immediately with jobId)
     */
    static scrapeAllAsync(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/yt-scraper/job/:jobId
     * Get scrape job status
     */
    static getJobStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/auto-connect
     * Try to auto-connect to YouTube Studio using existing session
     */
    static autoConnect(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/yt-scraper/results/latest
     * Get latest scrape result for each active KOC
     */
    static getLatestResults(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/yt-scraper/results/:kocId
     * Get scrape history for a specific KOC
     */
    static getKOCHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/yt-scraper/results/:kocId/latest
     * Get latest single scrape for a specific KOC
     */
    static getKOCLatest(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/create-revenue-records
     * Create revenue records from latest scraped data for a given cycle
     * Body: { cycleId: number }
     */
    static createRevenueRecords(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/yt-scraper/test-parse/:channelId
     * Test parse a channel and save debug info to file
     */
    static testParse(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/monthly/scrape/:kocId
     * Scrape monthly revenue analytics for a specific KOC
     */
    static scrapeMonthlyRevenue(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/monthly/scrape-all
     * Start background scrape of monthly revenue for all active KOCs.
     * Returns taskId immediately; client subscribes to SSE for progress.
     */
    static scrapeAllMonthlyRevenue(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/yt-scraper/monthly/:kocId
     * Get stored monthly revenue analytics for a KOC
     */
    static getMonthlyRevenue(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/verify-pub-code/:kocId
     * Scrape monetization page and verify pub code for a specific KOC
     */
    static verifyPubCode(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/verify-pub-codes
     * Verify pub codes for all active KOCs
     */
    static verifyAllPubCodes(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/yt-scraper/auto-login-config
     * Save Google credentials for auto-login
     */
    static saveAutoLoginConfig(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/yt-scraper/auto-login-config
     * Get current auto-login config (without password)
     */
    static getAutoLoginConfig(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=youtube-scraper.controller.d.ts.map