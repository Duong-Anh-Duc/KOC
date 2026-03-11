"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const youtube_scraper_controller_1 = require("../controllers/youtube-scraper.controller");
const middlewares_1 = require("../middlewares");
const router = (0, express_1.Router)();
router.use(middlewares_1.authMiddleware);
// Login management
router.post('/login', youtube_scraper_controller_1.YouTubeScraperController.openLogin);
router.get('/status', youtube_scraper_controller_1.YouTubeScraperController.checkStatus);
router.post('/auto-connect', youtube_scraper_controller_1.YouTubeScraperController.autoConnect);
router.post('/close', youtube_scraper_controller_1.YouTubeScraperController.closeBrowser);
router.post('/verify-session', youtube_scraper_controller_1.YouTubeScraperController.verifySession);
router.post('/import-cookies', youtube_scraper_controller_1.YouTubeScraperController.importCookies);
router.post('/sync-from-chrome', youtube_scraper_controller_1.YouTubeScraperController.syncFromChrome);
router.post('/reset-session', youtube_scraper_controller_1.YouTubeScraperController.resetSession);
router.post('/refresh-account-info', youtube_scraper_controller_1.YouTubeScraperController.refreshAccountInfo);
// Scrape all active KOCs
router.post('/scrape-all', youtube_scraper_controller_1.YouTubeScraperController.scrapeAll);
// Async batch scrape (non-blocking)
router.post('/scrape-all-async', youtube_scraper_controller_1.YouTubeScraperController.scrapeAllAsync);
router.get('/job/:jobId', youtube_scraper_controller_1.YouTubeScraperController.getJobStatus);
// Test parse endpoint (saves debug output to file) - MUST be before :kocId routes
router.get('/test-parse/:channelId', youtube_scraper_controller_1.YouTubeScraperController.testParse);
// Scrape results (from database)
router.get('/results/latest', youtube_scraper_controller_1.YouTubeScraperController.getLatestResults);
router.get('/results/:kocId', youtube_scraper_controller_1.YouTubeScraperController.getKOCHistory);
router.get('/results/:kocId/latest', youtube_scraper_controller_1.YouTubeScraperController.getKOCLatest);
// Create revenue records from latest scraped data
router.post('/create-revenue-records', youtube_scraper_controller_1.YouTubeScraperController.createRevenueRecords);
// Monthly revenue analytics
router.post('/monthly/scrape/:kocId', youtube_scraper_controller_1.YouTubeScraperController.scrapeMonthlyRevenue);
router.post('/monthly/scrape-all', youtube_scraper_controller_1.YouTubeScraperController.scrapeAllMonthlyRevenue);
router.get('/monthly/:kocId', youtube_scraper_controller_1.YouTubeScraperController.getMonthlyRevenue);
// Pub code verification
router.post('/verify-pub-code/:kocId', youtube_scraper_controller_1.YouTubeScraperController.verifyPubCode);
router.post('/verify-pub-codes', youtube_scraper_controller_1.YouTubeScraperController.verifyAllPubCodes);
// Auto-login configuration
router.post('/auto-login-config', youtube_scraper_controller_1.YouTubeScraperController.saveAutoLoginConfig);
router.get('/auto-login-config', youtube_scraper_controller_1.YouTubeScraperController.getAutoLoginConfig);
exports.default = router;
//# sourceMappingURL=youtube-scraper.routes.js.map