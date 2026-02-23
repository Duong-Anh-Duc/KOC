import fs from 'fs/promises';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import logger from '../middlewares/logger.middleware';

const TOKEN_PATH = path.join(process.cwd(), '.youtube-tokens.json');
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

interface ChannelTokens {
  [channelId: string]: {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
  };
}

interface AnalyticsData {
  overview: {
    totalViews: number;
    totalRevenue: number;
    subscribers: number;
    videosCount: number;
    watchTime: number;
  };
  content: {
    topVideos: Array<{
      title: string;
      views: number;
      revenue: number;
    }>;
  };
  audience: {
    geography: Array<{ country: string; percentage: number }>;
    demographics: {
      ageGroups: Array<{ range: string; percentage: number }>;
      gender: { male: number; female: number };
    };
  };
  revenue: {
    monthly: Array<{ month: string; revenue: number }>;
    totalRevenue: number;
    rpm: number;
  };
}

class YouTubeAPIService {
  private oauth2Client: OAuth2Client;
  private tokens: ChannelTokens = {};

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3001/api/youtube/oauth2callback'
    );
    this.loadTokens();
  }

  /**
   * Load saved tokens from file
   */
  private async loadTokens() {
    try {
      const data = await fs.readFile(TOKEN_PATH, 'utf-8');
      this.tokens = JSON.parse(data);
      logger.info('✓ Loaded YouTube tokens');
    } catch (error) {
      logger.info('No existing YouTube tokens found');
      this.tokens = {};
    }
  }

  /**
   * Save tokens to file
   */
  private async saveTokens() {
    await fs.writeFile(TOKEN_PATH, JSON.stringify(this.tokens, null, 2));
  }

  /**
   * Get OAuth URL for user to authorize
   */
  getAuthUrl(channelId: string): string {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: channelId, // pass channelId to callback
    });
    return authUrl;
  }

  /**
   * Handle OAuth callback and save tokens
   */
  async handleOAuthCallback(code: string, channelId: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.tokens[channelId] = tokens as any;
    await this.saveTokens();
    logger.info(`✓ Saved tokens for channel ${channelId}`);
  }

  /**
   * Check if channel has valid tokens
   */
  hasValidTokens(channelId: string): boolean {
    return !!this.tokens[channelId];
  }

  /**
   * Get authenticated client for specific channel
   */
  private getAuthenticatedClient(channelId: string): OAuth2Client {
    if (!this.tokens[channelId]) {
      throw new Error(`No tokens found for channel ${channelId}. Please authorize first.`);
    }

    const client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI
    );
    client.setCredentials(this.tokens[channelId]);
    return client;
  }

  /**
   * Fetch analytics data for a channel
   */
  async fetchAnalytics(channelId: string, startDate: string, endDate: string): Promise<AnalyticsData> {
    const auth = this.getAuthenticatedClient(channelId);
    const youtube = google.youtube({ version: 'v3', auth });
    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth });

    logger.info(`📊 Fetching analytics for ${channelId}...`);

    // Fetch overview metrics
    const overviewResponse = await youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views,estimatedRevenue,subscribersGained,subscribersLost,estimatedMinutesWatched',
      dimensions: 'day',
    });

    // Fetch top videos
    const topVideosResponse = await youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views,estimatedRevenue',
      dimensions: 'video',
      sort: '-views',
      maxResults: 10,
    });

    // Fetch geography data
    const geoResponse = await youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views',
      dimensions: 'country',
      sort: '-views',
      maxResults: 10,
    });

    // Fetch demographics (age/gender)
    const demographicsResponse = await youtubeAnalytics.reports.query({
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'viewerPercentage',
      dimensions: 'ageGroup,gender',
    });

    // Get channel info
    const channelResponse = await youtube.channels.list({
      part: ['statistics', 'snippet'],
      id: [channelId],
    });

    const channelStats = channelResponse.data.items?.[0]?.statistics;
    const overviewRows = overviewResponse.data.rows || [];
    const topVideosRows = topVideosResponse.data.rows || [];

    // Calculate totals
    const totalViews = overviewRows.reduce((sum, row) => sum + (row[1] as number || 0), 0);
    const totalRevenue = overviewRows.reduce((sum, row) => sum + (row[2] as number || 0), 0);
    const watchTime = overviewRows.reduce((sum, row) => sum + (row[5] as number || 0), 0);

    // Process top videos
    const topVideos = await Promise.all(
      topVideosRows.slice(0, 5).map(async (row) => {
        const videoId = row[0] as string;
        const videoResponse = await youtube.videos.list({
          part: ['snippet'],
          id: [videoId],
        });
        return {
          title: videoResponse.data.items?.[0]?.snippet?.title || videoId,
          views: row[1] as number,
          revenue: row[2] as number,
        };
      })
    );

    // Process geography
    const geoRows = geoResponse.data.rows || [];
    const totalGeoViews = geoRows.reduce((sum, row) => sum + (row[1] as number || 0), 0);
    const geography = geoRows.map((row) => ({
      country: row[0] as string,
      percentage: ((row[1] as number) / totalGeoViews) * 100,
    }));

    // Process demographics
    const demoRows = demographicsResponse.data.rows || [];
    const ageGroups = demoRows
      .filter((row) => row[1] === 'male' || row[1] === 'female')
      .reduce((acc: any, row) => {
        const age = row[0] as string;
        const existing = acc.find((a: any) => a.range === age);
        if (existing) {
          existing.percentage += row[2] as number;
        } else {
          acc.push({ range: age, percentage: row[2] as number });
        }
        return acc;
      }, []);

    const malePercentage = demoRows
      .filter((row) => row[1] === 'male')
      .reduce((sum, row) => sum + (row[2] as number || 0), 0);
    const femalePercentage = demoRows
      .filter((row) => row[1] === 'female')
      .reduce((sum, row) => sum + (row[2] as number || 0), 0);

    // Monthly revenue breakdown
    const monthlyRevenue = overviewRows
      .reduce((acc: any[], row) => {
        const date = row[0] as string;
        const month = date.substring(0, 7); // YYYY-MM
        const revenue = row[2] as number || 0;
        
        const existing = acc.find((m) => m.month === month);
        if (existing) {
          existing.revenue += revenue;
        } else {
          acc.push({ month, revenue });
        }
        return acc;
      }, []);

    return {
      overview: {
        totalViews,
        totalRevenue,
        subscribers: parseInt(channelStats?.subscriberCount || '0'),
        videosCount: parseInt(channelStats?.videoCount || '0'),
        watchTime,
      },
      content: {
        topVideos,
      },
      audience: {
        geography,
        demographics: {
          ageGroups,
          gender: {
            male: malePercentage,
            female: femalePercentage,
          },
        },
      },
      revenue: {
        monthly: monthlyRevenue,
        totalRevenue,
        rpm: totalViews > 0 ? (totalRevenue / totalViews) * 1000 : 0,
      },
    };
  }

  /**
   * Revoke access for a channel
   */
  async revokeAccess(channelId: string): Promise<void> {
    delete this.tokens[channelId];
    await this.saveTokens();
    logger.info(`✓ Revoked access for channel ${channelId}`);
  }
}

export const youtubeAPIService = new YouTubeAPIService();
