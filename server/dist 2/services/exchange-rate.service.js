"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeRateService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const playwright_1 = require("playwright");
const database_1 = __importDefault(require("../config/database"));
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
const revenue_service_1 = require("./revenue.service");
const youtube_scraper_service_1 = require("./youtube-scraper.service");
class ExchangeRateService {
    static MBBANK_URL = 'https://webgia.com/ty-gia/mbbank/';
    /** In-memory cache of the latest fetched rate */
    static cachedRate = null;
    /** Returns the cached exchange rate (or null if never fetched) */
    static getCachedRate() {
        return this.cachedRate;
    }
    /**
     * Convert VND to USD using current cached exchange rate
     * @param vndAmount Amount in Vietnamese Dong (₫)
     * @returns Amount in USD (rounded to 2 decimals), or null if input is null/0
     */
    static convertVndToUsd(vndAmount) {
        if (vndAmount === null || vndAmount === undefined || vndAmount === 0) {
            return vndAmount;
        }
        const currentRate = this.cachedRate?.averageRate;
        if (!currentRate || currentRate <= 0) {
            logger_middleware_1.default.warn(`⚠️ Cannot convert VND to USD: no valid exchange rate cached`);
            return null;
        }
        const usdAmount = vndAmount / currentRate;
        // Round to 2 decimal places
        return Math.round(usdAmount * 100) / 100;
    }
    /**
     * Start a background job that fetches the exchange rate every 10 minutes
     * and updates all OPEN revenue cycles automatically.
     */
    static startRateRefresher() {
        const run = async () => {
            // Skip if scraper Chromium is active to prevent OOM from concurrent instances
            if (youtube_scraper_service_1.YouTubeScraperService.isAnyScrapingActive()) {
                logger_middleware_1.default.info('💱 [AutoRate] Skipping rate fetch — scraping in progress (avoiding concurrent Chromium OOM)');
                return;
            }
            try {
                const data = await this.fetchRate();
                this.cachedRate = data;
                const newRate = data.averageRate;
                // Find all OPEN cycles
                const openCycles = await database_1.default.revenueCycle.findMany({
                    where: { status: 'OPEN' },
                    include: { revenue_records: { include: { koc: true } } },
                });
                for (const cycle of openCycles) {
                    const currentRate = Number(cycle.exchange_rate);
                    if (currentRate === newRate)
                        continue; // no change, skip
                    // Update exchange rate on cycle
                    await database_1.default.revenueCycle.update({
                        where: { id: cycle.id },
                        data: { exchange_rate: newRate },
                    });
                    // Recalculate all revenue records for this cycle
                    for (const record of cycle.revenue_records) {
                        const calculated = revenue_service_1.RevenueService.calculate({
                            originalRevenueUsd: Number(record.original_revenue_usd),
                            usTaxDeduction: Number(record.us_tax_deduction),
                            baseRate: Number(record.koc.base_rate),
                            exchangeRate: newRate,
                        });
                        await database_1.default.revenueRecord.update({
                            where: { id: record.id },
                            data: calculated,
                        });
                    }
                    logger_middleware_1.default.info(`💱 [AutoRate] Cycle ${cycle.month}: ${currentRate.toLocaleString()} → ${newRate.toLocaleString()} VND/USD (${cycle.revenue_records.length} records updated)`);
                }
                if (openCycles.length === 0) {
                    logger_middleware_1.default.info(`💱 [AutoRate] Rate fetched: ${newRate.toLocaleString()} VND/USD (no open cycles to update)`);
                }
            }
            catch (err) {
                logger_middleware_1.default.warn('⚠️ [AutoRate] Failed to refresh exchange rate:', err.message);
            }
        };
        // Run immediately on startup, then every 30 minutes
        run();
        node_cron_1.default.schedule('*/30 * * * *', run);
        logger_middleware_1.default.info('💱 Exchange rate auto-refresher started (every 30 minutes)');
    }
    /**
     * Fetch current USD/VND exchange rate from MBBank (via webgia.com)
     * Uses Playwright to wait for JavaScript rendering
     * Returns the transfer buy rate (mua chuyển khoản)
     */
    static async fetchRate() {
        let browser;
        try {
            logger_middleware_1.default.info('💱 Fetching USD/VND exchange rate from MBBank (Playwright)...');
            const isLinux = process.platform === 'linux';
            browser = await playwright_1.chromium.launch({
                headless: true,
                ...(isLinux && { executablePath: '/usr/bin/chromium' }),
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            });
            const page = await browser.newPage();
            await page.goto(this.MBBANK_URL, { waitUntil: 'networkidle', timeout: 30000 });
            // Wait for the exchange rate table to load
            await page.waitForSelector('table.table-exchanges tbody tr', { timeout: 10000 });
            // Extract USD row — find the 50,100 denomination row
            const usdData = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('table.table-exchanges tbody tr'));
                const usdRow = rows.find((row) => {
                    const text = row.textContent || '';
                    return text.includes('USD') && text.includes('50,100');
                });
                if (!usdRow)
                    return null;
                const cells = Array.from(usdRow.querySelectorAll('td'));
                // 0: Currency, 1: Name, 2: Buy cash, 3: Buy transfer <-- WE WANT THIS, 4: Sell cash, 5: Sell transfer
                const transferBuyText = cells[3]?.innerText?.trim() || '';
                return {
                    transferBuy: transferBuyText,
                    allCells: cells.map((c) => c.innerText?.trim() || ''),
                };
            });
            await browser.close();
            browser = undefined;
            if (!usdData || !usdData.transferBuy) {
                throw new Error(`Could not find USD transfer buy rate. Data: ${JSON.stringify(usdData)}`);
            }
            logger_middleware_1.default.info('USD row data:', usdData);
            const transferBuyRate = this.parseVNDNumber(usdData.transferBuy);
            if (transferBuyRate <= 0) {
                throw new Error(`Invalid transfer buy rate: ${usdData.transferBuy}`);
            }
            logger_middleware_1.default.info(`✅ Exchange rate fetched: 1 USD = ${transferBuyRate.toLocaleString()} VND (MBBank transfer buy)`);
            return {
                averageRate: transferBuyRate,
                source: this.MBBANK_URL,
                fetchedAt: new Date().toISOString(),
            };
        }
        catch (error) {
            logger_middleware_1.default.error('❌ Failed to fetch exchange rate from MBBank:', error.message);
            throw error;
        }
        finally {
            if (browser)
                await browser.close();
        }
    }
    /**
     * Parse VND number format: "25.765,00" → 25765
     * In Vietnamese format:
     * - Dot (.) is thousand separator
     * - Comma (,) is decimal separator
     * For exchange rates, we only need the integer part
     */
    static parseVNDNumber(str) {
        // Remove dots (thousand separator)
        const withoutThousandSep = str.replace(/\./g, '');
        // Take only the integer part (before comma)
        const integerPart = withoutThousandSep.split(',')[0];
        const num = parseInt(integerPart, 10);
        return isNaN(num) ? 0 : num;
    }
}
exports.ExchangeRateService = ExchangeRateService;
//# sourceMappingURL=exchange-rate.service.js.map