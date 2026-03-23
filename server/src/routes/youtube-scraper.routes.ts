import { Router } from 'express';
import { ScraperLoginController } from '../controllers/scraper-login.controller';
import { ScraperJobsController } from '../controllers/scraper-jobs.controller';
import { authMiddleware, canModify } from '../middlewares';

const router = Router();

router.use(authMiddleware);

// Login management
router.post('/login', canModify, ScraperLoginController.openLogin);
router.get('/status', ScraperLoginController.checkStatus);
router.post('/auto-connect', canModify, ScraperLoginController.autoConnect);
router.post('/close', canModify, ScraperLoginController.closeBrowser);
router.post('/verify-session', canModify, ScraperLoginController.verifySession);
router.post('/import-cookies', canModify, ScraperLoginController.importCookies);
router.post('/sync-from-chrome', canModify, ScraperLoginController.syncFromChrome);
router.post('/reset-session', canModify, ScraperLoginController.resetSession);
router.post('/refresh-account-info', canModify, ScraperLoginController.refreshAccountInfo);

// Scrape all active KOCs
router.post('/scrape-all', canModify, ScraperJobsController.scrapeAll);

// Async batch scrape (non-blocking)
router.post('/scrape-all-async', canModify, ScraperJobsController.scrapeAllAsync);
router.get('/job/:jobId', ScraperJobsController.getJobStatus);

// Test parse endpoint (saves debug output to file) - MUST be before :kocId routes
router.get('/test-parse/:channelId', ScraperJobsController.testParse);

// Scrape results (from database)
router.get('/results/latest', ScraperJobsController.getLatestResults);
router.get('/results/:kocId', ScraperJobsController.getKOCHistory);
router.get('/results/:kocId/latest', ScraperJobsController.getKOCLatest);

// Create revenue records from latest scraped data
router.post('/create-revenue-records', canModify, ScraperJobsController.createRevenueRecords);

// Monthly revenue analytics
router.post('/monthly/scrape/:kocId', canModify, ScraperJobsController.scrapeMonthlyRevenue);
router.post('/monthly/scrape-all', canModify, ScraperJobsController.scrapeAllMonthlyRevenue);
router.get('/monthly/:kocId', ScraperJobsController.getMonthlyRevenue);

// Pub code verification
router.post('/verify-pub-code/:kocId', canModify, ScraperJobsController.verifyPubCode);
router.post('/verify-pub-codes', canModify, ScraperJobsController.verifyAllPubCodes);

// Auto-login configuration
router.post('/auto-login-config', canModify, ScraperLoginController.saveAutoLoginConfig);
router.get('/auto-login-config', ScraperLoginController.getAutoLoginConfig);

export default router;
