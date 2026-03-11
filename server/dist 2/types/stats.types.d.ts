export type ColumnType = 'number_percent' | 'dollar_percent' | 'standalone_percent_or_dash' | 'standalone_num_or_dash' | 'standalone_time';
export interface ColumnSpec {
    key: string;
    type: ColumnType;
}
/** Totals from the by-country explore table */
export interface CountryStatsTotals {
    subscribersGained: number | null;
    subscribersLost: number | null;
    likes: number | null;
    dislikes: number | null;
    likeRatio: number | null;
    shares: number | null;
    newViewers: number | null;
    returningViewers: number | null;
    avgWatchTime: string | null;
    views: number | null;
    watchTimeHours: number | null;
    subscribersNet: number | null;
    estimatedRevenue: number | null;
    thumbnailImpressions: number | null;
    thumbnailCTR: number | null;
}
/** Single country row from explore table */
export interface CountryStatsRow {
    country: string;
    subscribersGained: number | null;
    subscribersGainedPercent: number | null;
    subscribersLost: number | null;
    subscribersLostPercent: number | null;
    likes: number | null;
    likesPercent: number | null;
    dislikes: number | null;
    dislikesPercent: number | null;
    likeRatio: number | null;
    shares: number | null;
    sharesPercent: number | null;
    newViewers: number | null;
    returningViewers: number | null;
    avgWatchTime: string | null;
    views: number | null;
    viewsPercent: number | null;
    watchTimeHours: number | null;
    watchTimePercent: number | null;
    subscribersNet: number | null;
    subscribersNetPercent: number | null;
    estimatedRevenue: number | null;
    revenuePercent: number | null;
    thumbnailImpressions: number | null;
    thumbnailCTR: number | null;
}
/** Totals from the by-day explore table */
export interface DayStatsTotals {
    views: number | null;
    watchTimeHours: number | null;
    avgWatchTime: string | null;
    estimatedRevenue: number | null;
}
/** Single day row from explore table */
export interface DayStatsRow {
    date: string;
    views: number | null;
    viewsPercent: number | null;
    watchTimeHours: number | null;
    watchTimePercent: number | null;
    avgWatchTime: string | null;
    estimatedRevenue: number | null;
    revenuePercent: number | null;
}
/** Full 28-day stats stored in ChannelStat.yt_analytics */
export interface ChannelStats28dData {
    byCountry: {
        totals: CountryStatsTotals;
        rows: CountryStatsRow[];
    };
    byDay: {
        totals: DayStatsTotals;
        rows: DayStatsRow[];
    };
    scrapedAt: string;
}
/**
 * Monthly row from YouTube Studio "Doanh thu ước tính theo Ngày" page
 * (granularity=MONTH dimension=MONTH)
 */
export interface MonthlyRevenueRow {
    monthLabel: string;
    monthKey: string;
    views: number | null;
    viewsPercent: number | null;
    watchTimeHours: number | null;
    watchTimePercent: number | null;
    avgWatchTime: string | null;
    estimatedRevenue: number | null;
    revenuePercent: number | null;
}
export interface MonthlyRevenueData {
    channelId: string;
    totals: {
        views: number | null;
        watchTimeHours: number | null;
        avgWatchTime: string | null;
        estimatedRevenue: number | null;
    };
    months: MonthlyRevenueRow[];
    scrapedAt: string;
}
//# sourceMappingURL=stats.types.d.ts.map