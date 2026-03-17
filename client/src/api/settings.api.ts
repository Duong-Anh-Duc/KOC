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
