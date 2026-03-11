import type { ChannelStats28dData } from '../types/stats.types';
export type { ChannelStats28dData, CountryStatsRow, CountryStatsTotals, DayStatsRow, DayStatsTotals } from '../types/stats.types';
export declare class SocialBladeService {
    /**
     * Build URL for 28-day explore by country
     */
    private static buildCountryExploreUrl;
    /**
     * Build URL for 28-day explore by day
     */
    private static buildDayExploreUrl;
    /**
     * Navigate to an explore page and extract body text
     */
    private static scrapeExplorePage;
    /**
     * Parse the by-country explore table text
     */
    private static parseCountryExploreText;
    /**
     * Parse the by-day explore table text
     */
    private static parseDayExploreText;
    /**
     * Scrape both explore tables (by country + by day) for a channel
     */
    static scrapeChannelStats(channelId: string, adminId?: string, channelName?: string): Promise<ChannelStats28dData>;
    private static write28DayLog;
    /**
     * Fetch and save 28d stats for a single KOC
     */
    static recordStats(kocId: string, adminId?: string): Promise<{
        id: string;
        koc_id: string;
        recorded_at: Date;
        view_count: bigint;
        sub_count: bigint;
        yt_analytics: import("@prisma/client/runtime/library").JsonValue | null;
    }>;
    /**
     * Fetch and save 28d stats for all active KOCs
     */
    static recordAllStats(adminId?: string): Promise<{
        success: number;
        failed: number;
        errors: {
            kocId: string;
            channelName: string;
            error: string;
        }[];
    }>;
    /**
     * Same as recordAllStats but emits SSE progress events via ProgressService.
     */
    static recordAllStatsWithProgress(taskId: string, adminId?: string): Promise<{
        success: number;
        failed: number;
        errors: {
            kocId: string;
            channelName: string;
            error: string;
        }[];
    }>;
    /**
     * Get channel stats history
     */
    static getStatsHistory(kocId: string, days?: number): Promise<{
        view_count: number | null;
        sub_count: number | null;
        id: string;
        koc_id: string;
        recorded_at: Date;
        yt_analytics: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    /**
     * Get latest stats for all KOCs
     */
    static getLatestStats(adminId?: string): Promise<{
        koc_id: string;
        full_name: string;
        channel_name: string;
        latest_stats: {
            id: string;
            koc_id: string;
            recorded_at: Date;
            view_count: bigint;
            sub_count: bigint;
            yt_analytics: import("@prisma/client/runtime/library").JsonValue | null;
        };
    }[]>;
    /**
     * Get 28d growth summary for all KOCs
     * Supports both new (byCountry/byDay) and old (overview/content/audience) formats
     */
    private static normalizeRevenueToUsd;
    /**
     * Get 28d growth summary for all KOCs
     * Supports both new (byCountry/byDay) and old (overview/content/audience) formats
     */
    static getAllKocsGrowth(adminId?: string): Promise<{
        koc_id: string;
        full_name: string;
        channel_name: string;
        youtube_channel_id: string;
        views_28d_num: any;
        watch_time_hours_28d_num: any;
        subs_gained_28d_num: any;
        subs_lost_28d_num: number;
        subs_net_28d_num: any;
        estimated_revenue_28d_num: number;
        likes_28d_num: any;
        shares_28d_num: number;
        has_data: boolean;
        last_recorded_at: Date;
    }[]>;
    /**
     * Get detailed 28d stats for a single KOC (country + day breakdown)
     */
    static getKocDetail(kocId: string): Promise<{
        koc_id: string;
        full_name: string;
        channel_name: string;
        youtube_channel_id: string;
        byCountry: any;
        byDay: any;
        has_data: boolean;
        last_recorded_at: Date;
    }>;
    /**
     * Get correlation data between views growth and revenue for a KOC
     */
    static getCorrelation(kocId: string, months?: number): Promise<{
        koc_id: string;
        full_name: string;
        channel_name: string;
        data: {
            month: string;
            revenue_usd: number;
            koc_receive_usd: number;
            views: number;
            subscribers: number;
        }[];
    }>;
}
//# sourceMappingURL=socialblade.service.d.ts.map