import type {
    ApiResponse,
    AuditLog,
    AuthUser,
    BulkCreateRevenueRecordInput,
    ChannelStat,
    CreateCycleInput,
    CreateKOCInput,
    CreateRevenueRecordInput,
    DashboardOverview,
    KOC,
    LoginInput,
    MonthlyRevenueAnalytics,
    PaginatedResponse,
    PaymentStatusMap,
    RevenueCycle,
    RevenueRecord,
    RevenueTrend,
    UpdateCycleInput,
    UpdateKOCInput,
    UpdateRevenueRecordInput,
    YouTubeScrapeResult,
} from '../types';
import apiClient from './client';

// ============================================================
// AUTH API
// ============================================================
export const authApi = {
  login: (data: LoginInput) =>
    apiClient.post<ApiResponse<{ token: string; user: AuthUser }>>('/auth/login', data),

  getProfile: () =>
    apiClient.get<ApiResponse<AuthUser>>('/auth/profile'),

  register: (data: { email: string; password: string; full_name: string; role?: string }) =>
    apiClient.post<ApiResponse<AuthUser>>('/auth/register', data),
};

// ============================================================
// KOC API
// ============================================================
export const kocApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: string }) =>
    apiClient.get<PaginatedResponse<KOC>>('/kocs', { params }),

  getActive: () =>
    apiClient.get<ApiResponse<Array<{ id: string; full_name: string; channel_name: string; base_rate: number }>>>('/kocs/active'),

  getById: (id: string) =>
    apiClient.get<ApiResponse<KOC>>(`/kocs/${id}`),

  create: (data: CreateKOCInput) =>
    apiClient.post<ApiResponse<KOC>>('/kocs', data),

  update: (id: string, data: UpdateKOCInput) =>
    apiClient.put<ApiResponse<KOC>>(`/kocs/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<ApiResponse>(`/kocs/${id}`),
};

// ============================================================
// REVENUE CYCLE API
// ============================================================
export const cycleApi = {
  getAll: () =>
    apiClient.get<ApiResponse<RevenueCycle[]>>('/cycles'),

  getById: (id: number) =>
    apiClient.get<ApiResponse<RevenueCycle>>(`/cycles/${id}`),

  create: (data: CreateCycleInput) =>
    apiClient.post<ApiResponse<RevenueCycle>>('/cycles', data),

  update: (id: number, data: UpdateCycleInput) =>
    apiClient.put<ApiResponse<RevenueCycle>>(`/cycles/${id}`, data),

  lock: (id: number) =>
    apiClient.patch<ApiResponse<RevenueCycle>>(`/cycles/${id}/lock`),

  reopen: (id: number) =>
    apiClient.patch<ApiResponse<RevenueCycle>>(`/cycles/${id}/reopen`),

  complete: (id: number) =>
    apiClient.patch<ApiResponse<RevenueCycle>>(`/cycles/${id}/complete`),

  delete: (id: number) =>
    apiClient.delete<ApiResponse>(`/cycles/${id}`),

  /** Fetch current USD/VND exchange rate from webgia.com */
  getExchangeRate: () =>
    apiClient.get<ApiResponse<{ averageRate: number; source: string; fetchedAt: string }>>('/cycles/exchange-rate'),

  /** Scrape YouTube revenue for KOCs in this cycle's month and auto-create records (returns taskId for SSE progress) */
  scrapeRevenue: (id: number, kocIds?: string[]) =>
    apiClient.post<ApiResponse<{ taskId: string }>>(`/cycles/${id}/scrape-revenue`, kocIds ? { kocIds } : undefined),

  checkPubCodes: (id: number) =>
    apiClient.post<ApiResponse<{ taskId: string }>>(`/cycles/${id}/check-pub-codes`),

  /** Add KOC(s) to an existing cycle with empty $0 records. Omit kocIds to add all missing active KOCs. */
  addKocsToCycle: (id: number, kocIds?: string[]) =>
    apiClient.post<ApiResponse<{ added: number; skipped: number }>>(`/cycles/${id}/add-kocs`, { kocIds }),
};

// ============================================================
// REVENUE RECORD API
// ============================================================
export const revenueApi = {
  getRecordsByCycle: (cycleId: number) =>
    apiClient.get<ApiResponse<RevenueRecord[]> & { totals: Record<string, number> }>('/revenue/records', {
      params: { cycle_id: cycleId },
    }),

  getRecordById: (id: string) =>
    apiClient.get<ApiResponse<RevenueRecord>>(`/revenue/records/${id}`),

  createRecord: (data: CreateRevenueRecordInput) =>
    apiClient.post<ApiResponse<RevenueRecord>>('/revenue/records', data),

  bulkCreateRecords: (data: BulkCreateRevenueRecordInput) =>
    apiClient.post<ApiResponse<RevenueRecord[]>>('/revenue/records/bulk', data),

  updateRecord: (id: string, data: UpdateRevenueRecordInput) =>
    apiClient.put<ApiResponse<RevenueRecord>>(`/revenue/records/${id}`, data),

  deleteRecord: (id: string) =>
    apiClient.delete<ApiResponse>(`/revenue/records/${id}`),

  bulkDeleteRecords: (ids: string[]) =>
    apiClient.delete<ApiResponse<{ deleted: number }>>('/revenue/records/bulk', { data: { ids } }),

  approveRecord: (id: string) =>
    apiClient.patch<ApiResponse<RevenueRecord>>(`/revenue/records/${id}/approve`),

  previewCalculation: (data: {
    original_revenue_usd: number;
    us_tax_deduction: number;
    base_rate?: number;
    exchange_rate?: number;
  }) =>
    apiClient.post<ApiResponse<RevenueRecord>>('/revenue/calculate', data),

  /** Get payment status for all KOCs in a cycle */
  getPaymentStatus: (cycleId: number) =>
    apiClient.get<ApiResponse<PaymentStatusMap>>('/revenue/payment-status', {
      params: { cycle_id: cycleId },
    }),
};

// ============================================================
// STATS API
// ============================================================
export const statsApi = {
  getHistory: (kocId: string, params?: { days?: number }) =>
    apiClient.get<ApiResponse<ChannelStat[]>>(`/stats/${kocId}`, { params }),

  fetchStats: (kocId: string) =>
    apiClient.post<ApiResponse<ChannelStat>>(`/stats/${kocId}/fetch`),

  fetchAllStats: () =>
    apiClient.post<ApiResponse<{ taskId: string }>>('/stats/fetch-all'),

  getLatest: () =>
    apiClient.get<ApiResponse<Array<{ koc_id: string; full_name: string; channel_name: string; latest_stats: ChannelStat | null }>>>('/stats/latest'),

  getGrowth: (kocId: string) =>
    apiClient.get<ApiResponse<{
      koc_id: string; full_name: string; channel_name: string; youtube_channel_id: string;
      byCountry: { totals: Record<string, any>; rows: any[] } | null;
      byDay: { totals: Record<string, any>; rows: any[] } | null;
      has_data: boolean; last_recorded_at: string | null;
    }>>(`/stats/${kocId}/growth`),

  getAllGrowth: () =>
    apiClient.get<ApiResponse<Array<{
      koc_id: string; full_name: string; channel_name: string; youtube_channel_id: string;
      views_28d_num: number; watch_time_hours_28d_num: number;
      subs_gained_28d_num: number; subs_lost_28d_num: number; subs_net_28d_num: number;
      estimated_revenue_28d_num: number; likes_28d_num: number; shares_28d_num: number;
      has_data: boolean; last_recorded_at: string | null;
    }>>>('/stats/growth/all'),
};

// ============================================================
// DASHBOARD API
// ============================================================
export const dashboardApi = {
  getOverview: () =>
    apiClient.get<ApiResponse<DashboardOverview>>('/dashboard/overview'),

  getRevenueTrend: (limit?: number) =>
    apiClient.get<ApiResponse<RevenueTrend[]>>('/dashboard/revenue-trend', { params: { limit } }),
};

// ============================================================
// AUDIT LOG API
// ============================================================
export const auditApi = {
  getLogs: (params?: { page?: number; limit?: number; entity?: string; entity_id?: string; user_id?: string }) =>
    apiClient.get<PaginatedResponse<AuditLog>>('/audit-logs', { params }),
};

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
    apiClient.post<ApiResponse<{
      koc: { id: string; name: string; channel: string };
      monthCount: number;
      totals: { views: number | null; watchTimeHours: number | null; avgWatchTime: string | null; estimatedRevenue: number | null };
      months: Array<{
        monthLabel: string; monthKey: string;
        views: number | null; viewsPercent: number | null;
        watchTimeHours: number | null; watchTimePercent: number | null;
        avgWatchTime: string | null;
        estimatedRevenue: number | null; revenuePercent: number | null;
      }>;
      scrapedAt: string;
    }>>(`/yt-scraper/monthly/scrape/${kocId}`),

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
};

// ============================================================
// EMAIL API
// ============================================================
export const emailApi = {
  /** Get email configuration */
  getConfig: () =>
    apiClient.get<ApiResponse<{
      smtpHost: string;
      smtpPort: number;
      smtpSecure: boolean;
      smtpUser: string;
      smtpPass: string;
      fromName: string;
      fromEmail: string;
      autoSendAfterCron: boolean;
    }>>('/email/config'),

  /** Update email configuration */
  updateConfig: (data: {
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser?: string;
    smtpPass?: string;
    fromName?: string;
    fromEmail?: string;
    autoSendAfterCron?: boolean;
  }) =>
    apiClient.put<ApiResponse>('/email/config', data),

  /** Send a test email */
  sendTest: (email: string) =>
    apiClient.post<ApiResponse<{ success: boolean; messageId?: string; error?: string }>>('/email/test', { email }),

  /** Send revenue emails for a specific month (returns taskId for SSE progress) */
  sendRevenueEmails: (month: string) =>
    apiClient.post<ApiResponse<{ taskId: string }>>('/email/send-revenue', { month }),

  /** Get available cycles for email sending */
  getCycles: () =>
    apiClient.get<ApiResponse<Array<{ id: number; month: string; status: string; recordCount: number }>>>('/email/cycles'),
};

// ============================================================
// CRON JOB API
// ============================================================
export const cronApi = {
  /** Get current cron configuration */
  getConfig: () =>
    apiClient.get<ApiResponse<{
      enabled: boolean;
      schedule: string;
      autoCreateCycle: boolean;
      autoScrapeRevenue: boolean;
      lastRunAt?: string;
      lastRunResult?: string;
      schedulerRunning: boolean;
      runHistory?: Array<{
        runAt: string;
        success: boolean;
        message: string;
        cycleMonth?: string;
      }>;
    }>>('/cron/config'),

  /** Update cron configuration */
  updateConfig: (data: {
    enabled?: boolean;
    schedule?: string;
    autoCreateCycle?: boolean;
    autoScrapeRevenue?: boolean;
  }) =>
    apiClient.put<ApiResponse<{
      enabled: boolean;
      schedule: string;
      autoCreateCycle: boolean;
      autoScrapeRevenue: boolean;
      schedulerRunning: boolean;
    }>>('/cron/config', data),

  /** Manually trigger the cron job */
  runNow: () =>
    apiClient.post<ApiResponse<{
      success: boolean;
      message: string;
      cycleMonth?: string;
    }>>('/cron/run'),

  /** Get run history */
  getHistory: () =>
    apiClient.get<ApiResponse<{
      lastRunAt: string | null;
      lastRunResult: string | null;
      runHistory: Array<{
        runAt: string;
        success: boolean;
        message: string;
        cycleMonth?: string;
      }>;
    }>>('/cron/history'),

  /** Preview next run target */
  previewNextRun: () =>
    apiClient.get<ApiResponse<{
      targetMonth: string;
      canRun: boolean;
      reason?: string;
      config: {
        enabled: boolean;
        schedule: string;
        autoCreateCycle: boolean;
        autoScrapeRevenue: boolean;
      };
    }>>('/cron/next-month'),
};

// ============================================================
// KOC ACCOUNT API (Admin creates account for KOC)
// ============================================================
export const kocAccountApi = {
  createAccount: (kocId: string, data: { email: string; password: string }) =>
    apiClient.post<ApiResponse<{ id: string; email: string; full_name: string; role: string; koc_id: string }>>(`/kocs/${kocId}/account`, data),
};

// ============================================================
// KOC PORTAL API (for KOC users to view their own data)
// ============================================================
export const kocPortalApi = {
  getMyRevenue: () =>
    apiClient.get<ApiResponse<{
      koc: KOC;
      records: (RevenueRecord & { cycle: { id: number; month: string; status: string; exchange_rate: number } })[];
    }>>('/koc-portal/my-revenue'),

  getMyStats: () =>
    apiClient.get<ApiResponse<{
      latestScrape: YouTubeScrapeResult | null;
      monthlyAnalytics: MonthlyRevenueAnalytics[];
    }>>('/koc-portal/my-stats'),
};
