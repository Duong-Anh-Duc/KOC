/**
 * Barrel export for yt-scraper submodules.
 */
export { YouTubeAnalyticsData, RevenueByCountry, safeClosePage } from './types';
export type { Page } from './types';

// Chrome profile helpers
export {
  CHROME_DATA_BASE_DIR,
  getChromeUserDataDir,
  getSystemChromeProfileDir,
  getSessionVerifiedFile,
  getAccountInfoFile,
  getPendingCookiesFile,
} from './chrome-profile';

// Browser context
export {
  getContext,
  closeBrowser,
  resetSession,
  openLoginBrowser,
  startHeadlessChrome,
  getRealChromePath,
  isCDPMode,
  cleanStaleLockFiles,
  initializePersistentSessions,
  hasValidSession,
  markSessionVerified,
  startKeepAlive,
  stopKeepAlive,
  minimizeWindow,
} from './browser-context.service';

// Session management
export {
  markSessionDisconnected,
  encryptPassword,
  decryptPassword,
  extractAndCacheAccountInfo,
  checkLoginStatus,
  openVerifyTab,
  closeLoginAndVerify,
  syncFromChrome,
  importCookies,
} from './session-manager.service';

// Revenue scraping
export {
  scrapeAnalytics,
  scrapeMultipleChannels,
  scrapeMultipleChannelsParallel,
  cleanChannelId,
  buildRevenueExploreUrl,
  writeKocLog,
} from './scrape-revenue.service';

// Shared state (for advanced use only)
export {
  contexts,
  scrapingInProgress,
} from './shared-state';
