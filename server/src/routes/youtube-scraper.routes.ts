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

export default router;
