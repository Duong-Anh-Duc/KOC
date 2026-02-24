import cron from 'node-cron';
import puppeteer from 'puppeteer';
import prisma from '../config/database';
import logger from '../middlewares/logger.middleware';
import { RevenueService } from './revenue.service';

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
   * Start a background job that fetches the exchange rate every 10 minutes
   * and updates all OPEN revenue cycles automatically.
   */
  static startRateRefresher(): void {
    const run = async () => {
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

    // Run immediately on startup, then every 10 minutes
    run();
    cron.schedule('*/10 * * * *', run);
    logger.info('💱 Exchange rate auto-refresher started (every 10 minutes)');
  }

  /**
   * Fetch current USD/VND exchange rate from MBBank (via webgia.com)
   * Uses Puppeteer to wait for JavaScript rendering
   * Returns the transfer buy rate (mua chuyển khoản)
   */
  static async fetchRate(): Promise<ExchangeRateData> {
    let browser;
    try {
      logger.info('💱 Fetching USD/VND exchange rate from MBBank (Puppeteer)...');

      // Launch headless browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      
      // Navigate to MBBank exchange rate page
      await page.goto(this.MBBANK_URL, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for the exchange rate table to load
      await page.waitForSelector('table.table-exchanges tbody tr', {
        timeout: 10000,
      });

      // Extract USD row data (first USD row is usually 50,100 denomination)
      const usdData = await page.evaluate(() => {
        // @ts-ignore - Code runs in browser context where DOM is available
        const rows = Array.from(document.querySelectorAll('table.table-exchanges tbody tr'));
        
        // Find first USD row
        // @ts-ignore
        const usdRow = rows.find((row: any) => {
          const text = row.textContent || '';
          return text.includes('USD') && text.includes('50,100');
        });

        if (!usdRow) {
          return null;
        }

        // Get all cells in the USD row
        // @ts-ignore
        const cells = Array.from(usdRow.querySelectorAll('td'));
        
        // Expected structure:
        // 0: Currency (USD 50,100)
        // 1: Name (Đô Mỹ)
        // 2: Buy cash (Mua tiền mặt)
        // 3: Buy transfer (Mua chuyển khoản) <- WE WANT THIS
        // 4: Sell cash (Bán tiền mặt)
        // 5: Sell transfer (Bán chuyển khoản)
        
        // @ts-ignore
        const transferBuyText = cells[3]?.textContent?.trim() || '';
        
        return {
          transferBuy: transferBuyText,
          // @ts-ignore
          allCells: cells.map((c: any) => c.textContent?.trim() || ''),
        };
      });

      await browser.close();
      browser = undefined;

      if (!usdData || !usdData.transferBuy) {
        logger.warn('Could not find USD transfer buy rate. Data:', usdData);
        throw new Error('Could not find USD transfer buy rate in table');
      }

      logger.info('USD row data:', usdData);

      // Parse the transfer buy rate
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
      if (browser) {
        await browser.close();
      }
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
