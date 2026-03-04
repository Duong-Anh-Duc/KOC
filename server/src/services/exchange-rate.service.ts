import axios from 'axios';
import cron from 'node-cron';
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
   * Fetch current USD/VND exchange rate.
   * Tries multiple sources (plain HTTP — no browser needed):
   * 1. open.er-api.com (free, no key)
   * 2. Vietcombank XML API
   * Falls back to 25,000 if all fail.
   */
  static async fetchRate(): Promise<ExchangeRateData> {
    // --- Source 1: open.er-api.com ---
    try {
      logger.info('💱 Fetching USD/VND exchange rate from open.er-api.com...');
      const res = await axios.get('https://open.er-api.com/v6/latest/USD', {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const vndRate = res.data?.rates?.VND;
      if (vndRate && vndRate > 0) {
        const rate = Math.round(vndRate);
        logger.info(`✅ Exchange rate fetched: 1 USD = ${rate.toLocaleString()} VND (open.er-api.com)`);
        return { averageRate: rate, source: 'open.er-api.com', fetchedAt: new Date().toISOString() };
      }
    } catch (err: any) {
      logger.warn(`⚠️ open.er-api.com failed: ${err.message}`);
    }

    // --- Source 2: Vietcombank XML API ---
    try {
      logger.info('💱 Fetching USD/VND exchange rate from Vietcombank...');
      const res = await axios.get(
        'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx?b=10',
        { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } },
      );
      const xml: string = res.data;
      // Parse sell rate for USD: <Exrate CurrencyCode="USD" ... Sell="25,768.00" ... />
      const match = xml.match(/CurrencyCode="USD"[^>]*Sell="([\d,]+\.?\d*)"/);
      if (match) {
        const raw = match[1].replace(/,/g, '').split('.')[0];
        const rate = parseInt(raw, 10);
        if (rate > 0) {
          logger.info(`✅ Exchange rate fetched: 1 USD = ${rate.toLocaleString()} VND (Vietcombank sell)`);
          return { averageRate: rate, source: 'Vietcombank', fetchedAt: new Date().toISOString() };
        }
      }
    } catch (err: any) {
      logger.warn(`⚠️ Vietcombank failed: ${err.message}`);
    }

    // --- Fallback: use cached or hardcoded ---
    const fallback = this.cachedRate?.averageRate || 25800;
    logger.warn(`⚠️ All exchange rate sources failed. Using fallback: ${fallback.toLocaleString()}`);
    return { averageRate: fallback, source: 'fallback', fetchedAt: new Date().toISOString() };
  }

}
