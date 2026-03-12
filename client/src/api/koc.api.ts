import type {
    ApiResponse,
    CreateKOCInput,
    KOC,
    MonthlyRevenueAnalytics,
    PaginatedResponse,
    RevenueRecord,
    UpdateKOCInput,
    YouTubeScrapeResult,
} from '../types';
import apiClient from './client';

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
