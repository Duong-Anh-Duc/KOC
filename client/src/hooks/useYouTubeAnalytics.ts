import { message } from 'antd';
import { useState } from 'react';
import { youtubeAPI } from '../api/youtube';
import type { YouTubeAnalyticsData } from '../types';

export const useYouTubeAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState<{ [channelId: string]: boolean }>({});
  const [data, setData] = useState<YouTubeAnalyticsData | null>(null);

  /**
   * Check if channel is authorized
   */
  const checkAuth = async (channelId: string) => {
    try {
      const response = await youtubeAPI.checkStatus(channelId);
      setAuthorized(prev => ({ ...prev, [channelId]: response.data.authorized }));
      return response.data.authorized;
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to check authorization');
      return false;
    }
  };

  /**
   * Start OAuth authorization flow
   */
  const authorize = async (channelId: string) => {
    try {
      setLoading(true);
      const response = await youtubeAPI.getAuthUrl(channelId);
      
      // Open OAuth URL in popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        response.data.authUrl,
        'YouTube Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for authorization completion
      const pollInterval = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(pollInterval);
          setLoading(false);
          message.info('Authorization window closed');
          return;
        }

        const isAuthorized = await checkAuth(channelId);
        if (isAuthorized) {
          clearInterval(pollInterval);
          popup?.close();
          setLoading(false);
          message.success('✅ Authorization successful!');
        }
      }, 2000);

      // Cleanup after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setLoading(false);
      }, 300000);
    } catch (error: any) {
      setLoading(false);
      message.error(error.response?.data?.message || 'Failed to get authorization URL');
    }
  };

  /**
   * Fetch analytics data
   */
  const fetchAnalytics = async (channelId: string, startDate: string, endDate: string) => {
    try {
      setLoading(true);
      const response = await youtubeAPI.fetchAnalytics(channelId, startDate, endDate);
      setData(response.data.data);
      message.success('✅ Analytics fetched successfully');
      return response.data.data;
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch analytics');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Revoke channel access
   */
  const revokeAccess = async (channelId: string) => {
    try {
      setLoading(true);
      await youtubeAPI.revokeAccess(channelId);
      setAuthorized(prev => ({ ...prev, [channelId]: false }));
      message.success('Access revoked successfully');
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to revoke access');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    authorized,
    data,
    checkAuth,
    authorize,
    fetchAnalytics,
    revokeAccess,
  };
};
