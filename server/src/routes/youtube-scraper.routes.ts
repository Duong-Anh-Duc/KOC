import { Router } from 'express';
import { YouTubeScraperController } from '../controllers/youtube-scraper.controller';
import { authMiddleware } from '../middlewares';

const router = Router();

router.use(authMiddleware);

// Login management
router.post('/login', YouTubeScraperController.openLogin);
router.get('/status', YouTubeScraperController.checkStatus);
router.post('/auto-connect', YouTubeScraperController.autoConnect);
router.post('/close', YouTubeScraperController.closeBrowser);
router.post('/verify-session', YouTubeScraperController.verifySession);
router.post('/import-cookies', YouTubeScraperController.importCookies);
router.post('/sync-from-chrome', YouTubeScraperController.syncFromChrome);
router.post('/reset-session', YouTubeScraperController.resetSession);
router.post('/refresh-account-info', YouTubeScraperController.refreshAccountInfo);

// Scrape all active KOCs
router.post('/scrape-all', YouTubeScraperController.scrapeAll);

// Async batch scrape (non-blocking)
router.post('/scrape-all-async', YouTubeScraperController.scrapeAllAsync);
router.get('/job/:jobId', YouTubeScraperController.getJobStatus);

// Test parse endpoint (saves debug output to file) - MUST be before :kocId routes
router.get('/test-parse/:channelId', YouTubeScraperController.testParse);

// Scrape results (from database)
router.get('/results/latest', YouTubeScraperController.getLatestResults);
router.get('/results/:kocId', YouTubeScraperController.getKOCHistory);
router.get('/results/:kocId/latest', YouTubeScraperController.getKOCLatest);

// Create revenue records from latest scraped data
router.post('/create-revenue-records', YouTubeScraperController.createRevenueRecords);

// Monthly revenue analytics
router.post('/monthly/scrape/:kocId', YouTubeScraperController.scrapeMonthlyRevenue);
router.post('/monthly/scrape-all', YouTubeScraperController.scrapeAllMonthlyRevenue);
router.get('/monthly/:kocId', YouTubeScraperController.getMonthlyRevenue);

// Pub code verification
router.post('/verify-pub-code/:kocId', YouTubeScraperController.verifyPubCode);
router.post('/verify-pub-codes', YouTubeScraperController.verifyAllPubCodes);

// Auto-login configuration
router.post('/auto-login-config', YouTubeScraperController.saveAutoLoginConfig);
router.get('/auto-login-config', YouTubeScraperController.getAutoLoginConfig);

export default router;
