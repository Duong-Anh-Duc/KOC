"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.youtubeAPIService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const googleapis_1 = require("googleapis");
const path_1 = __importDefault(require("path"));
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
const TOKEN_PATH = path_1.default.join(process.cwd(), '.youtube-tokens.json');
const SCOPES = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
];
class YouTubeAPIService {
    oauth2Client;
    tokens = {};
    constructor() {
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3001/api/youtube/oauth2callback');
        this.loadTokens();
    }
    /**
     * Load saved tokens from file
     */
    async loadTokens() {
        try {
            const data = await promises_1.default.readFile(TOKEN_PATH, 'utf-8');
            this.tokens = JSON.parse(data);
            logger_middleware_1.default.info('✓ Loaded YouTube tokens');
        }
        catch (error) {
            logger_middleware_1.default.info('No existing YouTube tokens found');
            this.tokens = {};
        }
    }
    /**
     * Save tokens to file
     */
    async saveTokens() {
        await promises_1.default.writeFile(TOKEN_PATH, JSON.stringify(this.tokens, null, 2));
    }
    /**
     * Get OAuth URL for user to authorize
     */
    getAuthUrl(channelId) {
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
    async handleOAuthCallback(code, channelId) {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.tokens[channelId] = tokens;
        await this.saveTokens();
        logger_middleware_1.default.info(`✓ Saved tokens for channel ${channelId}`);
    }
    /**
     * Check if channel has valid tokens
     */
    hasValidTokens(channelId) {
        return !!this.tokens[channelId];
    }
    /**
     * Get authenticated client for specific channel
     */
    getAuthenticatedClient(channelId) {
        if (!this.tokens[channelId]) {
            throw new Error(`No tokens found for channel ${channelId}. Please authorize first.`);
        }
        const client = new googleapis_1.google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET, process.env.YOUTUBE_REDIRECT_URI);
        client.setCredentials(this.tokens[channelId]);
        return client;
    }
    /**
     * Fetch analytics data for a channel
     */
    async fetchAnalytics(channelId, startDate, endDate) {
        const auth = this.getAuthenticatedClient(channelId);
        const youtube = googleapis_1.google.youtube({ version: 'v3', auth });
        const youtubeAnalytics = googleapis_1.google.youtubeAnalytics({ version: 'v2', auth });
        logger_middleware_1.default.info(`📊 Fetching analytics for ${channelId}...`);
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
        const totalViews = overviewRows.reduce((sum, row) => sum + (row[1] || 0), 0);
        const totalRevenue = overviewRows.reduce((sum, row) => sum + (row[2] || 0), 0);
        const watchTime = overviewRows.reduce((sum, row) => sum + (row[5] || 0), 0);
        // Process top videos
        const topVideos = await Promise.all(topVideosRows.slice(0, 5).map(async (row) => {
            const videoId = row[0];
            const videoResponse = await youtube.videos.list({
                part: ['snippet'],
                id: [videoId],
            });
            return {
                title: videoResponse.data.items?.[0]?.snippet?.title || videoId,
                views: row[1],
                revenue: row[2],
            };
        }));
        // Process geography
        const geoRows = geoResponse.data.rows || [];
        const totalGeoViews = geoRows.reduce((sum, row) => sum + (row[1] || 0), 0);
        const geography = geoRows.map((row) => ({
            country: row[0],
            percentage: (row[1] / totalGeoViews) * 100,
        }));
        // Process demographics
        const demoRows = demographicsResponse.data.rows || [];
        const ageGroups = demoRows
            .filter((row) => row[1] === 'male' || row[1] === 'female')
            .reduce((acc, row) => {
            const age = row[0];
            const existing = acc.find((a) => a.range === age);
            if (existing) {
                existing.percentage += row[2];
            }
            else {
                acc.push({ range: age, percentage: row[2] });
            }
            return acc;
        }, []);
        const malePercentage = demoRows
            .filter((row) => row[1] === 'male')
            .reduce((sum, row) => sum + (row[2] || 0), 0);
        const femalePercentage = demoRows
            .filter((row) => row[1] === 'female')
            .reduce((sum, row) => sum + (row[2] || 0), 0);
        // Monthly revenue breakdown
        const monthlyRevenue = overviewRows
            .reduce((acc, row) => {
            const date = row[0];
            const month = date.substring(0, 7); // YYYY-MM
            const revenue = row[2] || 0;
            const existing = acc.find((m) => m.month === month);
            if (existing) {
                existing.revenue += revenue;
            }
            else {
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
    async revokeAccess(channelId) {
        delete this.tokens[channelId];
        await this.saveTokens();
        logger_middleware_1.default.info(`✓ Revoked access for channel ${channelId}`);
    }
}
exports.youtubeAPIService = new YouTubeAPIService();
//# sourceMappingURL=youtube-api.service.js.map