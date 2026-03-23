import { Router } from 'express';
import { ScraperJobsController } from './scraper-jobs.controller';
import { authMiddleware, canModify } from '../../middlewares';

const router = Router();

router.use(authMiddleware);

// Scrape all active KOCs
router.post('/scrape-all', canModify, ScraperJobsController.scrapeAll);

// Async batch scrape (non-blocking)
router.post('/scrape-all-async', canModify, ScraperJobsController.scrapeAllAsync);
router.get('/job/:jobId', ScraperJobsController.getJobStatus);

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

export default router;
