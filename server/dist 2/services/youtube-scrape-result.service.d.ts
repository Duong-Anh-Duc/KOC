import { YouTubeAnalyticsData } from './youtube-scraper.service';
export declare class YouTubeScrapeResultService {
    /**
     * Save scrape result for a KOC
     */
    static saveResult(kocId: string, channelId: string, data: YouTubeAnalyticsData): Promise<{
        id: string;
        koc_id: string;
        views: bigint | null;
        channel_id: string;
        watch_time_hours: import("@prisma/client/runtime/library").Decimal | null;
        estimated_revenue: import("@prisma/client/runtime/library").Decimal | null;
        avg_watch_time: string | null;
        period: string | null;
        country_data: import("@prisma/client/runtime/library").JsonValue | null;
        raw_texts: import("@prisma/client/runtime/library").JsonValue | null;
        scraped_at: Date;
    }>;
    /**
     * Save multiple scrape results (batch from scrape-all)
     */
    static saveBatchResults(results: Array<{
        kocId: string;
        channelId: string;
        analytics: YouTubeAnalyticsData;
    }>): Promise<{
        saved: any[];
        errors: {
            kocId: string;
            error: string;
        }[];
    }>;
    /**
     * Get latest scrape result for each active KOC
     */
    static getLatestForAllKOCs(): Promise<{
        id: string;
        koc_id: string;
        channel_id: string;
        views: number | null;
        watch_time_hours: number | null;
        estimated_revenue: number | null;
        avg_watch_time: string | null;
        period: string | null;
        country_data: any;
        raw_texts: any;
        scraped_at: string;
        full_name: string;
        channel_name: string;
        youtube_channel_id: string;
        koc_status: string;
    }[]>;
    /**
     * Get scrape history for a specific KOC
     */
    static getHistoryByKOC(kocId: string, limit?: number): Promise<{
        views: number | null;
        watch_time_hours: number | null;
        estimated_revenue: number | null;
        koc: {
            full_name: string;
            channel_name: string;
        };
        id: string;
        koc_id: string;
        channel_id: string;
        avg_watch_time: string | null;
        period: string | null;
        country_data: import("@prisma/client/runtime/library").JsonValue | null;
        raw_texts: import("@prisma/client/runtime/library").JsonValue | null;
        scraped_at: Date;
    }[]>;
    /**
     * Get latest single scrape for a KOC
     */
    static getLatestByKOC(kocId: string): Promise<{
        views: number | null;
        watch_time_hours: number | null;
        estimated_revenue: number | null;
        koc: {
            full_name: string;
            channel_name: string;
        };
        id: string;
        koc_id: string;
        channel_id: string;
        avg_watch_time: string | null;
        period: string | null;
        country_data: import("@prisma/client/runtime/library").JsonValue | null;
        raw_texts: import("@prisma/client/runtime/library").JsonValue | null;
        scraped_at: Date;
    } | null>;
}
//# sourceMappingURL=youtube-scrape-result.service.d.ts.map