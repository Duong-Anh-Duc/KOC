import type {
    ApiResponse,
    MonthlyRevenueAnalytics,
    YouTubeScrapeResult,
} from '../types';
import apiClient from './client';

// ============================================================
// YOUTUBE SCRAPER API
// ============================================================
export const ytScraperApi = {
  /** Open browser for manual Google login */
  openLogin: () =>
    apiClient.post<ApiResponse>('/yt-scraper/login'),

  /** Check YouTube Studio login status */
  checkStatus: () =>
    apiClient.get<ApiResponse<{ loggedIn: boolean; channelName?: string; email?: string; loginBrowserOpen?: boolean }>>('/yt-scraper/status'),

  /** Try to auto-connect using existing session */
  autoConnect: () =>
    apiClient.post<ApiResponse<{ loggedIn: boolean; channelName?: string; email?: string }>>('/yt-scraper/auto-connect'),

  /** Scrape all active KOCs (returns taskId for SSE progress) */
  scrapeAll: () =>
    apiClient.post<ApiResponse<{ taskId: string }>>('/yt-scraper/scrape-all'),

  /** Start async scrape job for all active KOCs (returns immediately) */
  scrapeAllAsync: () =>
    apiClient.post<ApiResponse<{ jobId: string; channelCount: number }>>('/yt-scraper/scrape-all-async'),

  /** Get scrape job status */
  getJobStatus: (jobId: string) =>
    apiClient.get<ApiResponse<{ id: string; status: 'pending' | 'running' | 'completed' | 'failed'; results: any[]; errors: any[] }>>(`/yt-scraper/job/${jobId}`),

  /** Close browser */
  closeBrowser: () =>
    apiClient.post<ApiResponse>('/yt-scraper/close'),

  /** Close login browser and verify session with Playwright */
  verifySession: () =>
    apiClient.post<ApiResponse<{ loggedIn: boolean; channelName?: string; email?: string }>>('/yt-scraper/verify-session'),

  /** Reset saved Chrome session (allows login with a different account) */
  resetSession: () =>
    apiClient.post<ApiResponse>('/yt-scraper/reset-session'),

  /** Import cookies from local browser (alternative to VNC login) */
  importCookies: (cookies: Array<Record<string, unknown>>) =>
    apiClient.post<ApiResponse<{ loggedIn: boolean; channelName?: string; email?: string }>>('/yt-scraper/import-cookies', { cookies }),

  /** Auto-sync cookies from local Chrome (no extension needed) */
  syncFromChrome: (cdpUrl?: string) =>
    apiClient.post<ApiResponse<{ loggedIn: boolean; channelName?: string; email?: string }>>('/yt-scraper/sync-from-chrome', cdpUrl ? { cdpUrl } : {}),

  /** Extract & refresh connected account info (channel name, email) */
  refreshAccountInfo: () =>
    apiClient.post<ApiResponse<{ channelName?: string; email?: string }>>('/yt-scraper/refresh-account-info'),

  // ============== Scrape Results (from DB) ==============

  /** Get latest scrape result for each active KOC */
  getLatestResults: () =>
    apiClient.get<ApiResponse<YouTubeScrapeResult[]>>('/yt-scraper/results/latest'),

  /** Get scrape history for a specific KOC */
  getKOCHistory: (kocId: string, limit?: number) =>
    apiClient.get<ApiResponse<YouTubeScrapeResult[]>>(`/yt-scraper/results/${kocId}`, { params: { limit } }),

  /** Get latest single scrape for a specific KOC */
  getKOCLatest: (kocId: string) =>
    apiClient.get<ApiResponse<YouTubeScrapeResult>>(`/yt-scraper/results/${kocId}/latest`),

  /** Create revenue records from latest scraped data for a cycle */
  createRevenueRecords: (cycleId: number) =>
    apiClient.post<ApiResponse<{
      month: string;
      created: Array<{ koc: string; revenue: number }>;
      skipped: Array<{ koc: string; reason: string }>;
      summary: { totalKOCs: number; recordsCreated: number; recordsSkipped: number };
    }>>('/yt-scraper/create-revenue-records', { cycleId }),

  // ============== Monthly Revenue Analytics ==============

  /** Scrape monthly revenue for a specific KOC */
  scrapeMonthlyRevenue: (kocId: string) =>
    apiClient.post<ApiResponse<{ taskId: string }>>(`/yt-scraper/monthly/scrape/${kocId}`),

  /** Start background scrape of monthly revenue — returns taskId. Pass kocIds to limit scope. */
  scrapeAllMonthlyRevenue: (kocIds?: string[]) =>
    apiClient.post<ApiResponse<{ taskId: string }>>('/yt-scraper/monthly/scrape-all', kocIds ? { kocIds } : undefined),

  /** Get stored monthly revenue analytics for a KOC */
  getMonthlyRevenue: (kocId: string) =>
    apiClient.get<ApiResponse<MonthlyRevenueAnalytics[]>>(`/yt-scraper/monthly/${kocId}`),

  /** Verify pub code for a specific KOC */
  verifyPubCode: (kocId: string) =>
    apiClient.post<ApiResponse<{
      kocId: string;
      channelId: string;
      kocName: string;
      storedPubCode: string | null;
      scrapedPubCode: string | null;
      matched: boolean | null;
      error?: string;
    }>>(`/yt-scraper/verify-pub-code/${kocId}`),

  /** Verify pub codes for all active KOCs */
  verifyAllPubCodes: () =>
    apiClient.post<ApiResponse<{
      results: Array<{
        kocId: string;
        channelId: string;
        kocName: string;
        storedPubCode: string | null;
        scrapedPubCode: string | null;
        matched: boolean | null;
        error?: string;
      }>;
      summary: { total: number; matched: number; mismatched: number; noData: number; errors: number };
    }>>('/yt-scraper/verify-pub-codes'),

  getAutoLoginConfig: () => apiClient.get('/yt-scraper/auto-login-config'),
  saveAutoLoginConfig: (data: { email?: string; password?: string; enabled?: boolean }) =>
    apiClient.post('/yt-scraper/auto-login-config', data),
};

// ============================================================
// GOLOGIN API
// ============================================================
export const gologinApi = {
  /** Khởi động GoLogin profile và inject CDP URL cho scraper */
  start: (profileId?: string) =>
    apiClient.post<ApiResponse<{ wsUrl: string }>>('/gologin/start', profileId ? { profileId } : {}),

  /** Dừng GoLogin profile */
  stop: (stopLocal = false) =>
    apiClient.post<ApiResponse>('/gologin/stop', { stopLocal }),

  /** Trạng thái GoLogin profile hiện tại */
  getStatus: () =>
    apiClient.get<ApiResponse<{
      isRunning: boolean;
      profileId: string | null;
      wsUrl: string | null;
      cdpInjected: boolean;
      orbitaPath: string | null;
    }>>('/gologin/status'),
};

// ============================================================
// GEMLOGIN API
// ============================================================
export const gemloginApi = {
  getStatus: () =>
    apiClient.get<{
      success: boolean;
      isRunning: boolean;
      activeProfileId: string | null;
      apiUrl: string;
      cdpInjected: boolean;
    }>('/gemlogin/status'),

  start: (profileId?: string) =>
    apiClient.post<ApiResponse<{ wsUrl: string; cdpUrl: string; profileId: string }>>(
      '/gemlogin/start',
      { profileId: profileId || '1' },
    ),

  close: (profileId?: string) =>
    apiClient.post<ApiResponse>('/gemlogin/close', profileId ? { profileId } : {}),

  getProfiles: () =>
    apiClient.get<ApiResponse<Array<{ id: string; name: string; [key: string]: unknown }>>>('/gemlogin/profiles'),

  scrapeRevenue: (params?: {
    profileId?: string; month?: string; closeAfter?: boolean;
    batchSize?: number; waitSeconds?: number;
    kocIds?: string[]; saveToDb?: boolean;
  }) =>
    apiClient.post<ApiResponse<{ taskId: string }>>('/gemlogin/scrape-revenue', params || {}),

  runCron: (params?: { profileId?: string; closeAfter?: boolean }) =>
    apiClient.post<ApiResponse<{ cycleMonth?: string }>>('/gemlogin/run-cron', params || {}),
};
