import prisma from '../config/database';
import { REVENUE_CONSTANTS } from '../constants';
import { ApiError } from '../middlewares';
import logger from '../middlewares/logger.middleware';
import { RevenueCalculationInput, RevenueCalculationResult } from '../types';
import { PubCodeService } from './pub-code.service';

export class RevenueService {
  /**
   * Core revenue calculation formula
   * 
   * 1. Bank Fee = ((Original - US_Tax) * 0.25%) + $12
   * 2. Net Revenue = Original - US_Tax - Bank_Fee
   * 3. Company Share = Net * (1 - base_rate)
   * 4. KOC Gross = Net * base_rate (default 80%)
   * 5. KOC Tax = KOC_Gross * 10%
   * 6. Final USD = KOC_Gross - KOC_Tax
   * 7. Final VND = Final_USD * Exchange_Rate
   */
  static calculate(input: RevenueCalculationInput): RevenueCalculationResult {
    const { originalRevenueUsd, usTaxDeduction, baseRate, exchangeRate } = input;

    // Step 1: Bank Fee
    const bankFee = ((originalRevenueUsd - usTaxDeduction) * REVENUE_CONSTANTS.BANK_FEE_RATE) + REVENUE_CONSTANTS.BANK_FEE_FIXED;

    // Step 2: Net Revenue (after US tax and bank fee)
    const netRevenue = originalRevenueUsd - usTaxDeduction - bankFee;

    // Step 3: Company Share (EBE)
    const companyRate = 1 - baseRate;
    const companyShare = netRevenue * companyRate;

    // Step 4: KOC Gross Share
    const kocShareGross = netRevenue * baseRate;

    // Step 5: KOC Personal Income Tax (10%)
    const kocTaxDeduction = kocShareGross * REVENUE_CONSTANTS.KOC_TAX_RATE;

    // Step 6: Final USD
    const kocReceiveUsd = kocShareGross - kocTaxDeduction;

    // Step 7: Final VND
    const kocReceiveVnd = kocReceiveUsd * exchangeRate;

    return {
      original_revenue_usd: RevenueService.round2(originalRevenueUsd),
      us_tax_deduction: RevenueService.round2(usTaxDeduction),
      bank_fee: RevenueService.round2(bankFee),
      net_revenue: RevenueService.round2(netRevenue),
      company_share: RevenueService.round2(companyShare),
      koc_share_gross: RevenueService.round2(kocShareGross),
      koc_tax_deduction: RevenueService.round2(kocTaxDeduction),
      koc_receive_usd: RevenueService.round2(kocReceiveUsd),
      koc_receive_vnd: RevenueService.round2(kocReceiveVnd),
    };
  }

  /**
   * Create a revenue record for a KOC in a specific cycle
   */
  static async createRecord(
    kocId: string,
    cycleId: number,
    originalRevenueUsd: number,
    usTaxDeduction: number
  ) {
    // Get KOC base rate
    const koc = await prisma.kOC.findUnique({ where: { id: kocId } });
    if (!koc) throw new ApiError(404, 'koc.notFound');

    // Get cycle exchange rate
    const cycle = await prisma.revenueCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (cycle.status !== 'OPEN') throw new ApiError(400, 'revenue.cycleLocked');

    // Check duplicate
    const existing = await prisma.revenueRecord.findUnique({
      where: { koc_id_cycle_id: { koc_id: kocId, cycle_id: cycleId } },
    });
    if (existing) throw new ApiError(409, 'revenue.recordExists');

    // Calculate all fields
    const calculated = RevenueService.calculate({
      originalRevenueUsd,
      usTaxDeduction,
      baseRate: Number(koc.base_rate),
      exchangeRate: Number(cycle.exchange_rate),
    });

    // Scrape pub code from YouTube Studio
    let scrapedPubCode: string | null = null;
    let pubCodeMatch: boolean | null = null;

    try {
      scrapedPubCode = await PubCodeService.scrapePubCode(koc.youtube_channel_id);
      if (scrapedPubCode && koc.pub_code) {
        pubCodeMatch = scrapedPubCode === koc.pub_code;
      }
      logger.info(`Pub code for ${koc.full_name}: stored=${koc.pub_code}, scraped=${scrapedPubCode}, match=${pubCodeMatch}`);
    } catch (error: any) {
      logger.warn(`Failed to scrape pub code for ${koc.full_name}:`, error.message);
    }

    // Create record
    const record = await prisma.revenueRecord.create({
      data: {
        koc_id: kocId,
        cycle_id: cycleId,
        scraped_pub_code: scrapedPubCode,
        pub_code_match: pubCodeMatch,
        ...calculated,
      },
      include: {
        koc: { select: { full_name: true, channel_name: true, pub_code: true } },
        cycle: { select: { month: true, exchange_rate: true } },
      },
    });

    return record;
  }

  /**
   * Update a revenue record (recalculates all derived fields)
   */
  static async updateRecord(
    recordId: string,
    originalRevenueUsd?: number,
    usTaxDeduction?: number
  ) {
    const record = await prisma.revenueRecord.findUnique({
      where: { id: recordId },
      include: { koc: true, cycle: true },
    });

    if (!record) throw new ApiError(404, 'revenue.recordNotFound');
    if (record.cycle.status !== 'OPEN') throw new ApiError(400, 'revenue.cycleLocked');

    const newOriginal = originalRevenueUsd ?? Number(record.original_revenue_usd);
    const newTax = usTaxDeduction ?? Number(record.us_tax_deduction);

    const calculated = RevenueService.calculate({
      originalRevenueUsd: newOriginal,
      usTaxDeduction: newTax,
      baseRate: Number(record.koc.base_rate),
      exchangeRate: Number(record.cycle.exchange_rate),
    });

    // Scrape pub code from YouTube Studio
    let scrapedPubCode: string | null = null;
    let pubCodeMatch: boolean | null = null;

    try {
      scrapedPubCode = await PubCodeService.scrapePubCode(record.koc.youtube_channel_id);
      if (scrapedPubCode && record.koc.pub_code) {
        pubCodeMatch = scrapedPubCode === record.koc.pub_code;
      }
      logger.info(`Update: Pub code for ${record.koc.full_name}: stored=${record.koc.pub_code}, scraped=${scrapedPubCode}, match=${pubCodeMatch}`);
    } catch (error: any) {
      logger.warn(`Update: Failed to scrape pub code for ${record.koc.full_name}:`, error.message);
    }

    const oldValue = {
      original_revenue_usd: Number(record.original_revenue_usd),
      us_tax_deduction: Number(record.us_tax_deduction),
      koc_receive_usd: Number(record.koc_receive_usd),
      koc_receive_vnd: Number(record.koc_receive_vnd),
    };

    const updated = await prisma.revenueRecord.update({
      where: { id: recordId },
      data: {
        ...calculated,
        scraped_pub_code: scrapedPubCode,
        pub_code_match: pubCodeMatch,
      },
      include: {
        koc: { select: { full_name: true, channel_name: true, pub_code: true } },
        cycle: { select: { month: true, exchange_rate: true } },
      },
    });

    return { record: updated, oldValue };
  }

  /**
   * Bulk create revenue records for a cycle
   */
  static async bulkCreateRecords(
    cycleId: number,
    records: Array<{ koc_id: string; original_revenue_usd: number; us_tax_deduction: number }>
  ) {
    const cycle = await prisma.revenueCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new ApiError(404, 'revenue.cycleNotFound');
    if (cycle.status !== 'OPEN') throw new ApiError(400, 'revenue.cycleLocked');

    const results = [];

    for (const item of records) {
      const koc = await prisma.kOC.findUnique({ where: { id: item.koc_id } });
      if (!koc) continue;

      // Check if record already exists
      const existing = await prisma.revenueRecord.findUnique({
        where: { koc_id_cycle_id: { koc_id: item.koc_id, cycle_id: cycleId } },
      });

      const calculated = RevenueService.calculate({
        originalRevenueUsd: item.original_revenue_usd,
        usTaxDeduction: item.us_tax_deduction,
        baseRate: Number(koc.base_rate),
        exchangeRate: Number(cycle.exchange_rate),
      });

      // Scrape pub code
      let scrapedPubCode: string | null = null;
      let pubCodeMatch: boolean | null = null;

      try {
        scrapedPubCode = await PubCodeService.scrapePubCode(koc.youtube_channel_id);
        if (scrapedPubCode && koc.pub_code) {
          pubCodeMatch = scrapedPubCode === koc.pub_code;
        }
        logger.info(`Bulk: Pub code for ${koc.full_name}: stored=${koc.pub_code}, scraped=${scrapedPubCode}, match=${pubCodeMatch}`);
      } catch (error: any) {
        logger.warn(`Bulk: Failed to scrape pub code for ${koc.full_name}:`, error.message);
      }

      const record = await prisma.revenueRecord.upsert({
        where: { koc_id_cycle_id: { koc_id: item.koc_id, cycle_id: cycleId } },
        update: { ...calculated, scraped_pub_code: scrapedPubCode, pub_code_match: pubCodeMatch },
        create: {
          koc_id: item.koc_id,
          cycle_id: cycleId,
          scraped_pub_code: scrapedPubCode,
          pub_code_match: pubCodeMatch,
          ...calculated,
        },
      });

      results.push({ record, isNew: !existing, oldValue: existing });
    }

    return results;
  }

  /**
   * Get all records for a specific cycle
   * @param statusFilter - Optional filter: 'APPROVED' | 'PENDING' to get only records with that status
   */
  static async getRecordsByCycle(cycleId: number, statusFilter?: 'APPROVED' | 'PENDING') {
    const records = await prisma.revenueRecord.findMany({
      where: {
        cycle_id: cycleId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        koc: {
          select: {
            full_name: true,
            channel_name: true,
            bank_account_number: true,
            bank_name: true,
          },
        },
        cycle: {
          select: { month: true, exchange_rate: true, status: true },
        },
      },
      orderBy: { koc: { full_name: 'asc' } },
    });

    // Calculate totals
    const totals = records.reduce(
      (acc, r) => ({
        totalOriginal: acc.totalOriginal + Number(r.original_revenue_usd),
        totalNetRevenue: acc.totalNetRevenue + Number(r.net_revenue),
        totalCompanyShare: acc.totalCompanyShare + Number(r.company_share),
        totalKocReceiveUsd: acc.totalKocReceiveUsd + Number(r.koc_receive_usd),
        totalKocReceiveVnd: acc.totalKocReceiveVnd + Number(r.koc_receive_vnd),
      }),
      {
        totalOriginal: 0,
        totalNetRevenue: 0,
        totalCompanyShare: 0,
        totalKocReceiveUsd: 0,
        totalKocReceiveVnd: 0,
      }
    );

    return { records, totals };
  }

  /**
   * Get revenue record by ID
   */
  static async getRecordById(recordId: string) {
    const record = await prisma.revenueRecord.findUnique({
      where: { id: recordId },
      include: {
        koc: true,
        cycle: true,
      },
    });

    if (!record) throw new ApiError(404, 'revenue.recordNotFound');
    return record;
  }

  /**
   * Delete a revenue record
   */
  static async deleteRecord(recordId: string) {
    const record = await prisma.revenueRecord.findUnique({
      where: { id: recordId },
      include: { cycle: true },
    });

    if (!record) throw new ApiError(404, 'revenue.recordNotFound');
    if (record.cycle.status !== 'OPEN') throw new ApiError(400, 'revenue.cannotDeleteFromLocked');

    await prisma.revenueRecord.delete({ where: { id: recordId } });
    return record;
  }

  /**
   * Approve a revenue record.
   * Only allows approval if accumulated revenue >= $100 threshold.
   */
  static async approveRecord(recordId: string) {
    const record = await prisma.revenueRecord.findUnique({
      where: { id: recordId },
      include: { cycle: true },
    });
    if (!record) throw new ApiError(404, 'revenue.recordNotFound');

    // Check $100 threshold
    const paymentStatus = await RevenueService.getPaymentStatus(record.cycle_id);
    const kocStatus = paymentStatus[record.koc_id];
    if (kocStatus?.belowThreshold) {
      throw new ApiError(400, 'revenue.belowThreshold');
    }

    return prisma.revenueRecord.update({
      where: { id: recordId },
      data: { status: 'APPROVED' },
    });
  }

  /**
   * Get payment status for each record in a cycle.
   * Uses per-KOC min_payment threshold. Accumulates original_revenue_usd across months.
   * When a cycle is PAYMENT_COMPLETED, records in that cycle are considered paid → reset accumulation.
   * Returns map of koc_id -> { accumulated, belowThreshold, accumulatedMonths, threshold }
   */
  static async getPaymentStatus(cycleId: number) {
    const cycle = await prisma.revenueCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');

    // Get all cycles ordered by month for comparison
    const allCycles = await prisma.revenueCycle.findMany({
      orderBy: { month: 'asc' },
    });

    // Find cycles before (and including) current cycle
    const currentIdx = allCycles.findIndex(c => c.id === cycleId);
    const relevantCycles = allCycles.slice(0, currentIdx + 1);

    // Get all records for relevant cycles
    const records = await prisma.revenueRecord.findMany({
      where: { cycle_id: { in: relevantCycles.map(c => c.id) } },
      include: { cycle: true },
      orderBy: { cycle: { month: 'asc' } },
    });

    // Build cycle status map (to know which cycles are PAYMENT_COMPLETED)
    const cycleStatusMap = new Map<number, string>();
    for (const c of allCycles) {
      cycleStatusMap.set(c.id, c.status);
    }

    // Get all KOCs with their min_payment
    const kocIds = [...new Set(records.map(r => r.koc_id))];
    const kocs = await prisma.kOC.findMany({
      where: { id: { in: kocIds } },
      select: { id: true, min_payment: true },
    });
    const kocThresholdMap = new Map<string, number>();
    for (const koc of kocs) {
      kocThresholdMap.set(koc.id, Number(koc.min_payment));
    }

    // Group records by KOC
    const kocRecords = new Map<string, Array<{ cycleId: number; revenue: number; month: string; status: string; cycleStatus: string }>>();
    for (const record of records) {
      const entries = kocRecords.get(record.koc_id) || [];
      entries.push({
        cycleId: record.cycle_id,
        revenue: Number(record.original_revenue_usd),
        month: record.cycle.month,
        status: record.status,
        cycleStatus: cycleStatusMap.get(record.cycle_id) || 'OPEN',
      });
      kocRecords.set(record.koc_id, entries);
    }

    // Calculate accumulated balance for each KOC
    const result: Record<string, { accumulated: number; belowThreshold: boolean; accumulatedMonths: Array<{ month: string; revenue: number }>; threshold: number }> = {};

    for (const [kocId, entries] of kocRecords) {
      const threshold = kocThresholdMap.get(kocId) ?? REVENUE_CONSTANTS.MIN_PAYMENT_THRESHOLD;
      let accumulated = 0;
      const accumulatedMonths: Array<{ month: string; revenue: number }> = [];

      for (const entry of entries) {
        // If the cycle was PAYMENT_COMPLETED, that means payment was made → reset
        if (entry.cycleStatus === 'PAYMENT_COMPLETED') {
          accumulated = 0;
          accumulatedMonths.length = 0;
          continue;
        }

        accumulated += entry.revenue;
        accumulatedMonths.push({ month: entry.month, revenue: entry.revenue });
      }

      result[kocId] = {
        accumulated: RevenueService.round2(accumulated),
        belowThreshold: accumulated < threshold,
        accumulatedMonths,
        threshold,
      };
    }

    return result;
  }

  /** Round to 2 decimal places */
  private static round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
