import type {
    ApiResponse,
} from '../types';
import apiClient from './client';

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

  /** Send revenue emails for a specific month, optionally filtered by KOC IDs */
  sendRevenueEmails: (month: string, kocIds?: string[]) =>
    apiClient.post<ApiResponse<{ taskId: string }>>('/email/send-revenue', { month, ...(kocIds && kocIds.length > 0 ? { kocIds } : {}) }),

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
// GOOGLE LOGIN AUTO-LOGIN API
// ============================================================
export interface GoogleLoginStatus {
  email: string | null;
  hasPassword: boolean;
  hasTotpSecret: boolean;
  /** Password đã giải mã — admin có thể xem qua eye toggle */
  password: string | null;
  /** TOTP secret đã giải mã */
  totpSecret: string | null;
  autoLoginEnabled: boolean;
  lastResult: string | null;
  lastAttemptAt: string | null;
}

export const googleLoginApi = {
  /** Lấy trạng thái credentials (KHÔNG trả password/secret thô) */
  getConfig: () =>
    apiClient.get<ApiResponse<GoogleLoginStatus>>('/settings/google-login'),

  /** Cập nhật credentials — chỉ field truyền sẽ update */
  updateConfig: (data: {
    email?: string | null;
    password?: string | null;
    totpSecret?: string | null;
    autoLoginEnabled?: boolean;
  }) =>
    apiClient.put<ApiResponse<GoogleLoginStatus>>('/settings/google-login', data),

  /** Trigger auto-login ngay để verify credentials. incognito=true → context mới, không cookie. */
  test: (incognito = true) =>
    apiClient.post<{
      success: boolean;
      loggedIn: boolean;
      incognito: boolean;
      message: string;
      finalUrl?: string;
    }>('/settings/google-login/test', { incognito }),

  /** Trạng thái Google đã login chưa (đọc DB, nhẹ) */
  getGoogleStatus: () =>
    apiClient.get<{
      success: boolean;
      loggedIn: boolean;
      verifiedAt: string | null;
      disconnectedAt: string | null;
      disconnectReason: string | null;
      message: string;
    }>('/gemlogin/google-status'),

  /**
   * Live check + auto-login nếu cần. Trả `taskId` ngay → FE subscribe SSE
   * `/api/progress/:taskId` để xem step text trực tiếp ("Đang nhập mật khẩu..." v.v.).
   */
  checkGoogleStatusNow: () =>
    apiClient.post<{
      success: boolean;
      taskId: string;
    }>('/gemlogin/google-status/check'),
};
