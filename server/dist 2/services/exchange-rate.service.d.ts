export interface ExchangeRateData {
    /** Average rate across banks: 1 USD = ? VND */
    averageRate: number;
    /** Source URL */
    source: string;
    /** Fetched at */
    fetchedAt: string;
}
export declare class ExchangeRateService {
    private static readonly MBBANK_URL;
    /** In-memory cache of the latest fetched rate */
    private static cachedRate;
    /** Returns the cached exchange rate (or null if never fetched) */
    static getCachedRate(): ExchangeRateData | null;
    /**
     * Convert VND to USD using current cached exchange rate
     * @param vndAmount Amount in Vietnamese Dong (₫)
     * @returns Amount in USD (rounded to 2 decimals), or null if input is null/0
     */
    static convertVndToUsd(vndAmount: number | null): number | null;
    /**
     * Start a background job that fetches the exchange rate every 10 minutes
     * and updates all OPEN revenue cycles automatically.
     */
    static startRateRefresher(): void;
    /**
     * Fetch current USD/VND exchange rate from MBBank (via webgia.com)
     * Uses Playwright to wait for JavaScript rendering
     * Returns the transfer buy rate (mua chuyển khoản)
     */
    static fetchRate(): Promise<ExchangeRateData>;
    /**
     * Parse VND number format: "25.765,00" → 25765
     * In Vietnamese format:
     * - Dot (.) is thousand separator
     * - Comma (,) is decimal separator
     * For exchange rates, we only need the integer part
     */
    private static parseVNDNumber;
}
//# sourceMappingURL=exchange-rate.service.d.ts.map