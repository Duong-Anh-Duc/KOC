import type {
    ApiResponse,
    ChannelStat,
} from '../types';
import apiClient from './client';

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
