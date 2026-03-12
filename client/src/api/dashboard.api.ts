import type {
    ApiResponse,
    AuditLog,
    DashboardOverview,
    PaginatedResponse,
    RevenueTrend,
} from '../types';
import apiClient from './client';

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
