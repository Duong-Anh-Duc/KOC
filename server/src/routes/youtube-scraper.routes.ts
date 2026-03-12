import { Router } from 'express';
import { ScraperLoginController } from '../controllers/scraper-login.controller';
import { ScraperJobsController } from '../controllers/scraper-jobs.controller';
import { authMiddleware } from '../middlewares';

const router = Router();

router.use(authMiddleware);

// Login management
router.post('/login', ScraperLoginController.openLogin);
router.get('/status', ScraperLoginController.checkStatus);
router.post('/auto-connect', ScraperLoginController.autoConnect);
router.post('/close', ScraperLoginController.closeBrowser);
router.post('/verify-session', ScraperLoginController.verifySession);
router.post('/import-cookies', ScraperLoginController.importCookies);
router.post('/sync-from-chrome', ScraperLoginController.syncFromChrome);
router.post('/reset-session', ScraperLoginController.resetSession);
router.post('/refresh-account-info', ScraperLoginController.refreshAccountInfo);

// Scrape all active KOCs
router.post('/scrape-all', ScraperJobsController.scrapeAll);

// Async batch scrape (non-blocking)
router.post('/scrape-all-async', ScraperJobsController.scrapeAllAsync);
router.get('/job/:jobId', ScraperJobsController.getJobStatus);

// Test parse endpoint (saves debug output to file) - MUST be before :kocId routes
router.get('/test-parse/:channelId', ScraperJobsController.testParse);

// Scrape results (from database)
router.get('/results/latest', ScraperJobsController.getLatestResults);
router.get('/results/:kocId', ScraperJobsController.getKOCHistory);
router.get('/results/:kocId/latest', ScraperJobsController.getKOCLatest);

// Create revenue records from latest scraped data
router.post('/create-revenue-records', ScraperJobsController.createRevenueRecords);

// Monthly revenue analytics
router.post('/monthly/scrape/:kocId', ScraperJobsController.scrapeMonthlyRevenue);
router.post('/monthly/scrape-all', ScraperJobsController.scrapeAllMonthlyRevenue);
router.get('/monthly/:kocId', ScraperJobsController.getMonthlyRevenue);

// Pub code verification
router.post('/verify-pub-code/:kocId', ScraperJobsController.verifyPubCode);
router.post('/verify-pub-codes', ScraperJobsController.verifyAllPubCodes);

// Auto-login configuration
router.post('/auto-login-config', ScraperLoginController.saveAutoLoginConfig);
router.get('/auto-login-config', ScraperLoginController.getAutoLoginConfig);

export default router;
