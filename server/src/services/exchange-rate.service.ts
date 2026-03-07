import cron from 'node-cron';
import { chromium } from 'playwright';
import prisma from '../config/database';
import logger from '../middlewares/logger.middleware';
import { RevenueService } from './revenue.service';
import { YouTubeScraperService } from './youtube-scraper.service';

export interface ExchangeRateData {
  /** Average rate across banks: 1 USD = ? VND */
  averageRate: number;
  /** Source URL */
  source: string;
  /** Fetched at */
  fetchedAt: string;
}

export class ExchangeRateService {
  private static readonly MBBANK_URL = 'https://webgia.com/ty-gia/mbbank/';

  /** In-memory cache of the latest fetched rate */
  private static cachedRate: ExchangeRateData | null = null;

  /** Returns the cached exchange rate (or null if never fetched) */
  static getCachedRate(): ExchangeRateData | null {
    return this.cachedRate;
  }

  /**
   * Convert VND to USD using current cached exchange rate
   * @param vndAmount Amount in Vietnamese Dong (₫)
   * @returns Amount in USD (rounded to 2 decimals), or null if input is null/0
   */
  static convertVndToUsd(vndAmount: number | null): number | null {
    if (vndAmount === null || vndAmount === undefined || vndAmount === 0) {
      return vndAmount;
    }

    const currentRate = this.cachedRate?.averageRate;
    if (!currentRate || currentRate <= 0) {
      logger.warn(`⚠️ Cannot convert VND to USD: no valid exchange rate cached`);
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
  static startRateRefresher(): void {
    const run = async () => {
      // Skip if scraper Chromium is active to prevent OOM from concurrent instances
      if (YouTubeScraperService.isAnyScrapingActive()) {
        logger.info('💱 [AutoRate] Skipping rate fetch — scraping in progress (avoiding concurrent Chromium OOM)');
        return;
      }
      try {
        const data = await this.fetchRate();
        this.cachedRate = data;
        const newRate = data.averageRate;

        // Find all OPEN cycles
        const openCycles = await prisma.revenueCycle.findMany({
          where: { status: 'OPEN' },
          include: { revenue_records: { include: { koc: true } } },
        });

        for (const cycle of openCycles) {
          const currentRate = Number(cycle.exchange_rate);
          if (currentRate === newRate) continue; // no change, skip

          // Update exchange rate on cycle
          await prisma.revenueCycle.update({
            where: { id: cycle.id },
            data: { exchange_rate: newRate },
          });

          // Recalculate all revenue records for this cycle
          for (const record of cycle.revenue_records) {
            const calculated = RevenueService.calculate({
              originalRevenueUsd: Number(record.original_revenue_usd),
              usTaxDeduction: Number(record.us_tax_deduction),
              baseRate: Number(record.koc.base_rate),
              exchangeRate: newRate,
            });

            await prisma.revenueRecord.update({
              where: { id: record.id },
              data: calculated,
            });
          }

          logger.info(
            `💱 [AutoRate] Cycle ${cycle.month}: ${currentRate.toLocaleString()} → ${newRate.toLocaleString()} VND/USD (${cycle.revenue_records.length} records updated)`,
          );
        }

        if (openCycles.length === 0) {
          logger.info(`💱 [AutoRate] Rate fetched: ${newRate.toLocaleString()} VND/USD (no open cycles to update)`);
        }
      } catch (err: any) {
        logger.warn('⚠️ [AutoRate] Failed to refresh exchange rate:', err.message);
      }
    };

    // Run immediately on startup, then every 30 minutes
    run();
    cron.schedule('*/30 * * * *', run);
    logger.info('💱 Exchange rate auto-refresher started (every 30 minutes)');
  }

  /**
   * Fetch current USD/VND exchange rate from MBBank (via webgia.com)
   * Uses Playwright to wait for JavaScript rendering
   * Returns the transfer buy rate (mua chuyển khoản)
   */
  static async fetchRate(): Promise<ExchangeRateData> {
    let browser;
    try {
      logger.info('💱 Fetching USD/VND exchange rate from MBBank (Playwright)...');

      const isLinux = process.platform === 'linux';
      browser = await chromium.launch({
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
        const usdRow = rows.find((row: any) => {
          const text = row.textContent || '';
          return text.includes('USD') && text.includes('50,100');
        }) as HTMLTableRowElement | undefined;

        if (!usdRow) return null;

        const cells = Array.from(usdRow.querySelectorAll('td'));
        // 0: Currency, 1: Name, 2: Buy cash, 3: Buy transfer <-- WE WANT THIS, 4: Sell cash, 5: Sell transfer
        const transferBuyText = (cells[3] as HTMLElement)?.innerText?.trim() || '';

        return {
          transferBuy: transferBuyText,
          allCells: cells.map((c: any) => c.innerText?.trim() || ''),
        };
      });

      await browser.close();
      browser = undefined;

      if (!usdData || !usdData.transferBuy) {
        throw new Error(`Could not find USD transfer buy rate. Data: ${JSON.stringify(usdData)}`);
      }

      logger.info('USD row data:', usdData);

      const transferBuyRate = this.parseVNDNumber(usdData.transferBuy);
      if (transferBuyRate <= 0) {
        throw new Error(`Invalid transfer buy rate: ${usdData.transferBuy}`);
      }

      logger.info(`✅ Exchange rate fetched: 1 USD = ${transferBuyRate.toLocaleString()} VND (MBBank transfer buy)`);
      return {
        averageRate: transferBuyRate,
        source: this.MBBANK_URL,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('❌ Failed to fetch exchange rate from MBBank:', error.message);
      throw error;
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Parse VND number format: "25.765,00" → 25765
   * In Vietnamese format:
   * - Dot (.) is thousand separator
   * - Comma (,) is decimal separator
   * For exchange rates, we only need the integer part
   */
  private static parseVNDNumber(str: string): number {
    // Remove dots (thousand separator)
    const withoutThousandSep = str.replace(/\./g, '');
    // Take only the integer part (before comma)
    const integerPart = withoutThousandSep.split(',')[0];
    const num = parseInt(integerPart, 10);
    return isNaN(num) ? 0 : num;
  }
}
