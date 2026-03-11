import type { MonthlyRevenueData, MonthlyRevenueRow } from '../types/stats.types';
export type { MonthlyRevenueData, MonthlyRevenueRow } from '../types/stats.types';
export declare class MonthlyRevenueService {
    /**
     * Build URL for monthly revenue explore page
     * This uses dimension=MONTH and granularity=MONTH to get per-month breakdown
     * Matching the URL pattern from YouTube Studio
     */
    private static buildMonthlyRevenueUrl;
    /**
     * Scrape monthly revenue data for a channel using the existing browser session
     */
    static scrapeMonthlyRevenue(channelId: string, adminId?: string): Promise<MonthlyRevenueData>;
    /**
     * Parse the monthly revenue explore page text.
     * Expected format (Vietnamese):
     *   Ngày ↓ | Số lượt xem ⚠ | Thời gian xem (giờ) | Thời lượng xem trung bình | Doanh thu ước tính
     *   Tổng   | 106.766.532    | 441.649,8           | 0:27                      | 1.327,87 $
     *   Tháng 2 (đang diễn ra) | 2.729.250 2,6% | 12.646,8 2,9% | 0:31 | 24,98 $ 1,9%
     *   Tháng 1 | 7.215.190 6,8% | 35.540,2 8,1% | 0:33 | 81,96 $ 6,2%
     */
    static parseMonthlyRevenueText(text: string): {
        totals: MonthlyRevenueData['totals'];
        months: MonthlyRevenueRow[];
    };
    /**
     * Extract month number from label like "Tháng 2 (đang diễn ra)" → 2
     */
    private static extractMonthNumber;
    /**
     * Compute month_key in YYYY-MM format
     * YouTube Studio shows months in DESC order: current month first, then back in time
     * We need to figure out the year based on the month number pattern
     */
    private static computeMonthKey;
    private static extractRowValues;
    /**
     * Save monthly revenue data for a KOC
     */
    static saveMonthlyRevenue(kocId: string, channelId: string, data: MonthlyRevenueData): Promise<any[]>;
    /**
     * Get monthly revenue analytics for a KOC
     */
    static getByKOC(kocId: string): Promise<{
        views: number | null;
        views_percent: number | null;
        watch_time_hours: number | null;
        watch_time_percent: number | null;
        estimated_revenue: number | null;
        revenue_percent: number | null;
        koc: {
            full_name: string;
            channel_name: string;
            youtube_channel_id: string;
        };
        id: string;
        koc_id: string;
        channel_id: string;
        avg_watch_time: string | null;
        scraped_at: Date;
        month_label: string;
        month_key: string;
    }[]>;
    /**
     * After saving monthly data, auto-sync revenue into matching open cycles.
     * monthKey format: "2026-01" → cycle month: "01/2026"
     */
    private static syncToCycles;
    /**
     * Scrape and save monthly revenue for a single KOC
     */
    static scrapeAndSave(kocId: string, channelId: string, adminId?: string, channelName?: string): Promise<MonthlyRevenueData>;
    private static writeMonthlyLog;
    /**
     * Scrape and save monthly revenue for all active KOCs
     */
    static scrapeAllKOCs(adminId?: string, onProgress?: (current: number, total: number, channelName: string) => void, kocIds?: string[]): Promise<{
        results: Array<{
            kocId: string;
            channelName: string;
            monthCount: number;
        }>;
        errors: Array<{
            kocId: string;
            channelName: string;
            error: string;
        }>;
    }>;
}
//# sourceMappingURL=monthly-revenue.service.d.ts.map