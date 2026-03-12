// Re-export from split controllers for backward compatibility
export { ScraperLoginController } from './scraper-login.controller';
export { ScraperJobsController } from './scraper-jobs.controller';

// Backward-compatible alias: combines both controllers under the original name
import { ScraperLoginController } from './scraper-login.controller';
import { ScraperJobsController } from './scraper-jobs.controller';

export const YouTubeScraperController = {
  // Login flow
  openLogin: ScraperLoginController.openLogin,
  checkStatus: ScraperLoginController.checkStatus,
  verifySession: ScraperLoginController.verifySession,
  importCookies: ScraperLoginController.importCookies,
  syncFromChrome: ScraperLoginController.syncFromChrome,
  closeBrowser: ScraperLoginController.closeBrowser,
  resetSession: ScraperLoginController.resetSession,
  autoConnect: ScraperLoginController.autoConnect,
  refreshAccountInfo: ScraperLoginController.refreshAccountInfo,
  saveAutoLoginConfig: ScraperLoginController.saveAutoLoginConfig,
  getAutoLoginConfig: ScraperLoginController.getAutoLoginConfig,

  // Scraping jobs
  scrapeAll: ScraperJobsController.scrapeAll,
  scrapeAllAsync: ScraperJobsController.scrapeAllAsync,
  getJobStatus: ScraperJobsController.getJobStatus,
  getLatestResults: ScraperJobsController.getLatestResults,
  getKOCHistory: ScraperJobsController.getKOCHistory,
  getKOCLatest: ScraperJobsController.getKOCLatest,
  createRevenueRecords: ScraperJobsController.createRevenueRecords,
  testParse: ScraperJobsController.testParse,
  scrapeMonthlyRevenue: ScraperJobsController.scrapeMonthlyRevenue,
  scrapeAllMonthlyRevenue: ScraperJobsController.scrapeAllMonthlyRevenue,
  getMonthlyRevenue: ScraperJobsController.getMonthlyRevenue,
  verifyPubCode: ScraperJobsController.verifyPubCode,
  verifyAllPubCodes: ScraperJobsController.verifyAllPubCodes,
};
