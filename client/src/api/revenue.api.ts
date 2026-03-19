import type {
    ApiResponse,
    BulkCreateRevenueRecordInput,
    CreateCycleInput,
    CreateRevenueRecordInput,
    PaymentStatusMap,
    RevenueCycle,
    RevenueRecord,
    UpdateCycleInput,
    UpdateRevenueRecordInput,
} from '../types';
import apiClient from './client';

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

  unapproveRecord: (id: string) =>
    apiClient.patch<ApiResponse<RevenueRecord>>(`/revenue/records/${id}/unapprove`),

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
