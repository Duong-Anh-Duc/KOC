import type { YouTubeAnalyticsData } from '../types';
import apiClient from './client';

export const youtubeAPI = {
  /**
   * Get OAuth authorization URL for a channel
   */
  getAuthUrl: (channelId: string) =>
    apiClient.post<{ success: boolean; authUrl: string; message: string }>(
      `/youtube/auth/${channelId}`
    ),

  /**
   * Check if channel is authorized
   */
  checkStatus: (channelId: string) =>
    apiClient.get<{ success: boolean; authorized: boolean }>(
      `/youtube/status/${channelId}`
    ),

  /**
   * Fetch analytics data for a channel
   */
  fetchAnalytics: (channelId: string, startDate: string, endDate: string) =>
    apiClient.post<{ success: boolean; data: YouTubeAnalyticsData }>(
      `/youtube/analytics/${channelId}`,
      { startDate, endDate }
    ),

  /**
   * Revoke access for a channel
   */
  revokeAccess: (channelId: string) =>
    apiClient.delete<{ success: boolean; message: string }>(
      `/youtube/auth/${channelId}`
    ),
};
