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
        geography: Array<{
            country: string;
            percentage: number;
        }>;
        demographics: {
            ageGroups: Array<{
                range: string;
                percentage: number;
            }>;
            gender: {
                male: number;
                female: number;
            };
        };
    };
    revenue: {
        monthly: Array<{
            month: string;
            revenue: number;
        }>;
        totalRevenue: number;
        rpm: number;
    };
}
declare class YouTubeAPIService {
    private oauth2Client;
    private tokens;
    constructor();
    /**
     * Load saved tokens from file
     */
    private loadTokens;
    /**
     * Save tokens to file
     */
    private saveTokens;
    /**
     * Get OAuth URL for user to authorize
     */
    getAuthUrl(channelId: string): string;
    /**
     * Handle OAuth callback and save tokens
     */
    handleOAuthCallback(code: string, channelId: string): Promise<void>;
    /**
     * Check if channel has valid tokens
     */
    hasValidTokens(channelId: string): boolean;
    /**
     * Get authenticated client for specific channel
     */
    private getAuthenticatedClient;
    /**
     * Fetch analytics data for a channel
     */
    fetchAnalytics(channelId: string, startDate: string, endDate: string): Promise<AnalyticsData>;
    /**
     * Revoke access for a channel
     */
    revokeAccess(channelId: string): Promise<void>;
}
export declare const youtubeAPIService: YouTubeAPIService;
export {};
//# sourceMappingURL=youtube-api.service.d.ts.map