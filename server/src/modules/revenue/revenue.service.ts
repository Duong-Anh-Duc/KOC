import prisma from '../../config/database';
import { REVENUE_CONSTANTS } from '../../constants';
import { ApiError } from '../../middlewares';
import { RevenueCalculationInput, RevenueCalculationResult } from '../../types';

export class RevenueService {
  /**
   * Parse "MM/YYYY" to a comparable number YYYYMM for correct chronological ordering.
   * e.g. "01/2026" → 202601, "12/2025" → 202512
   */
  private static monthToSortKey(month: string): number {
    const [mm, yyyy] = month.split('/');
    return parseInt(yyyy, 10) * 100 + parseInt(mm, 10);
  }

  /**
   * Get IDs of all cycles that are chronologically before (or before-or-equal) the given cycle.
   * Uses parsed month comparison instead of cycle_id integer comparison.
   */
  private static async getCycleIdsBefore(
    currentCycleMonth: string,
    adminId?: string | null,
    inclusive = false
  ): Promise<number[]> {
    const adminFilter = adminId ? { admin_id: adminId } : {};
    const allCycles = await prisma.revenueCycle.findMany({
      where: adminFilter,
      select: { id: true, month: true },
    });
    const currentKey = RevenueService.monthToSortKey(currentCycleMonth);
    return allCycles
      .filter(c => {
        const key = RevenueService.monthToSortKey(c.month);
        return inclusive ? key <= currentKey : key < currentKey;
      })
      .map(c => c.id);
  }

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
    // If net-before-fee is less than or equal to bank fee, waive bank fee entirely (avoid negative net)
    const netBeforeFee = originalRevenueUsd - usTaxDeduction;
    const rawBankFee = (netBeforeFee * REVENUE_CONSTANTS.BANK_FEE_RATE) + REVENUE_CONSTANTS.BANK_FEE_FIXED;
    const bankFee = netBeforeFee <= rawBankFee ? 0 : rawBankFee;

    // Step 2: Net Revenue (after US tax and bank fee)
    const netRevenue = netBeforeFee - bankFee;

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
    usTaxDeduction: number,
    adminId?: string
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

    // Create record
    const record = await prisma.revenueRecord.create({
      data: {
        koc_id: kocId,
        cycle_id: cycleId,
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
    usTaxDeduction?: number,
    accumulatedRevenueUsd?: number,
    adminId?: string
  ) {
    const record = await prisma.revenueRecord.findUnique({
      where: { id: recordId },
      include: { koc: true, cycle: true },
    });

    if (!record) throw new ApiError(404, 'revenue.recordNotFound');
    if (record.cycle.status !== 'OPEN') throw new ApiError(400, 'revenue.cycleLocked');

    const newOriginal = originalRevenueUsd ?? Number(record.original_revenue_usd);
    const newTax = usTaxDeduction ?? Number(record.us_tax_deduction);
    const newAccumulated = accumulatedRevenueUsd ?? Number(record.accumulated_revenue_usd || newOriginal);

    const monthlyCalculated = RevenueService.calculate({
      originalRevenueUsd: newOriginal,
      usTaxDeduction: newTax,
      baseRate: Number(record.koc.base_rate),
      exchangeRate: Number(record.cycle.exchange_rate),
    });

    // Accumulated KOC payout = sum of each month's own payout (per-month), not a
    // single calculation on the accumulated total. So each month keeps its own
    // $12 bank fee. Previous unpaid months + this (new) month.
    const prevPending = await prisma.revenueRecord.findMany({
      where: { koc_id: record.koc_id, status: 'PENDING', cycle_id: { lt: record.cycle_id } },
      select: { koc_receive_usd: true },
    });
    const accumulatedKocUsd = RevenueService.round2(
      prevPending.reduce((s, p) => s + Number(p.koc_receive_usd), 0) + monthlyCalculated.koc_receive_usd
    );

    const oldValue = {
      original_revenue_usd: Number(record.original_revenue_usd),
      us_tax_deduction: Number(record.us_tax_deduction),
      accumulated_revenue_usd: Number(record.accumulated_revenue_usd),
      accumulated_koc_usd: Number(record.accumulated_koc_usd),
      koc_receive_usd: Number(record.koc_receive_usd),
      koc_receive_vnd: Number(record.koc_receive_vnd),
    };

    const updated = await prisma.revenueRecord.update({
      where: { id: recordId },
      data: {
        original_revenue_usd: newOriginal,
        us_tax_deduction: newTax,
        bank_fee: monthlyCalculated.bank_fee,
        net_revenue: monthlyCalculated.net_revenue,
        company_share: monthlyCalculated.company_share,
        koc_share_gross: monthlyCalculated.koc_share_gross,
        koc_tax_deduction: monthlyCalculated.koc_tax_deduction,
        koc_receive_usd: monthlyCalculated.koc_receive_usd,
        koc_receive_vnd: monthlyCalculated.koc_receive_vnd,
        accumulated_revenue_usd: newAccumulated,
        accumulated_koc_usd: accumulatedKocUsd,
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
    records: Array<{ koc_id: string; original_revenue_usd: number; us_tax_deduction: number }>,
    adminId?: string
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

      const record = await prisma.revenueRecord.upsert({
        where: { koc_id_cycle_id: { koc_id: item.koc_id, cycle_id: cycleId } },
        update: { ...calculated },
        create: { koc_id: item.koc_id, cycle_id: cycleId, ...calculated },
      });

      results.push({ record, isNew: !existing, oldValue: existing });
    }

    return results;
  }

  /**
   * Get all records for a specific cycle
   * @param statusFilter - Optional filter: 'APPROVED' | 'PENDING' to get only records with that status
   */
  static async getRecordsByCycle(cycleId: number, statusFilter?: 'APPROVED' | 'PENDING', adminId?: string, allowedKocIds?: string[]) {
    // Build KOC filter for admin scoping or manager-level KOC filtering
    // Always exclude INACTIVE KOCs — their scraped revenue should not appear on UI
    const kocFilter = adminId
      ? { koc: { admin_id: adminId, status: 'ACTIVE' as const } }
      : allowedKocIds
        ? { koc_id: { in: allowedKocIds }, koc: { status: 'ACTIVE' as const } }
        : { koc: { status: 'ACTIVE' as const } };

    const records = await prisma.revenueRecord.findMany({
      where: {
        cycle_id: cycleId,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...kocFilter,
      },
      include: {
        koc: {
          select: {
            full_name: true,
            channel_name: true,
            bank_account_number: true,
            bank_name: true,
            base_rate: true,
          },
        },
        cycle: {
          select: { month: true, exchange_rate: true, status: true },
        },
      },
      orderBy: { koc: { full_name: 'asc' } },
    });

    // Dynamically compute accumulated from previous cycles (not from stored DB value).
    // Include PENDING records (not yet paid) AND records that were APPROVED in this same cycle
    // (paid_in_cycle_id = cycleId) — those were auto-approved together with the current month,
    // so they must still count toward the accumulated total shown in this cycle's view.
    const kocIds = records.map(r => r.koc_id);

    // Use month-based comparison (not cycle_id integer) to find chronologically earlier cycles
    const currentCycle = await prisma.revenueCycle.findUnique({ where: { id: cycleId } });
    const prevCycleIds = currentCycle
      ? await RevenueService.getCycleIdsBefore(currentCycle.month, currentCycle.admin_id, false)
      : [];

    const prevPendingRecords = kocIds.length > 0 && prevCycleIds.length > 0
      ? await prisma.revenueRecord.findMany({
          where: {
            koc_id: { in: kocIds },
            cycle_id: { in: prevCycleIds },
            OR: [
              { status: 'PENDING' },
              { paid_in_cycle_id: cycleId },
            ],
          },
        })
      : [];

    // Group previous PENDING months per KOC. Keep each month separate so every
    // month can be calculated independently (see below).
    const prevMonthsByKoc = new Map<string, Array<{ original: number; usTax: number }>>();
    for (const r of prevPendingRecords) {
      const arr = prevMonthsByKoc.get(r.koc_id) ?? [];
      arr.push({ original: Number(r.original_revenue_usd), usTax: Number(r.us_tax_deduction) });
      prevMonthsByKoc.set(r.koc_id, arr);
    }

    // Recalculate ALL accumulated fields by calculating EACH month independently
    // (each with its own bank fee, KOC tax, etc.) and summing the results — NOT
    // by running the formula once on the accumulated total. This means the fixed
    // $12 bank fee is charged once PER MONTH. (min_payment threshold still uses
    // the accumulated gross revenue — see getPaymentStatus.)
    const enrichedRecords = records.map(r => {
      const baseRate = Number((r.koc as any).base_rate ?? 0.8);
      const exchangeRate = Number(r.cycle.exchange_rate);

      // All months being settled together = previous pending months + this month.
      const months = [
        ...(prevMonthsByKoc.get(r.koc_id) ?? []),
        { original: Number(r.original_revenue_usd), usTax: Number(r.us_tax_deduction) },
      ];

      const naturalGross = RevenueService.round2(months.reduce((s, m) => s + m.original, 0));
      const totalUsTax = RevenueService.round2(months.reduce((s, m) => s + m.usTax, 0));

      // Manual override: if an admin typed an accumulated revenue that differs from
      // the natural per-month sum, honor that value and run the formula ONCE on it
      // (we can't split a manual total back into months). Otherwise, calculate each
      // month independently and sum (so each month keeps its own $12 bank fee).
      const storedGross = RevenueService.round2(Number(r.accumulated_revenue_usd ?? 0));
      const isOverride = storedGross > 0 && Math.abs(storedGross - naturalGross) > 0.01;

      const acc = isOverride
        ? (() => {
            const c = RevenueService.calculate({
              originalRevenueUsd: storedGross,
              usTaxDeduction: totalUsTax,
              baseRate,
              exchangeRate,
            });
            return {
              revenue: storedGross,
              usTax: c.us_tax_deduction,
              bankFee: c.bank_fee,
              net: c.net_revenue,
              company: c.company_share,
              gross: c.koc_share_gross,
              kocTax: c.koc_tax_deduction,
              kocUsd: c.koc_receive_usd,
            };
          })()
        : months.reduce(
            (sum, m) => {
              const c = RevenueService.calculate({
                originalRevenueUsd: m.original,
                usTaxDeduction: m.usTax,
                baseRate,
                exchangeRate,
              });
              sum.revenue += m.original;
              sum.usTax += c.us_tax_deduction;
              sum.bankFee += c.bank_fee;
              sum.net += c.net_revenue;
              sum.company += c.company_share;
              sum.gross += c.koc_share_gross;
              sum.kocTax += c.koc_tax_deduction;
              sum.kocUsd += c.koc_receive_usd;
              return sum;
            },
            { revenue: 0, usTax: 0, bankFee: 0, net: 0, company: 0, gross: 0, kocTax: 0, kocUsd: 0 }
          );

      const accKocUsd = RevenueService.round2(acc.kocUsd);

      return {
        ...r,
        accumulated_revenue_usd: RevenueService.round2(acc.revenue),
        accumulated_us_tax: RevenueService.round2(acc.usTax),
        accumulated_bank_fee: RevenueService.round2(acc.bankFee),
        accumulated_net_revenue: RevenueService.round2(acc.net),
        accumulated_company_share: RevenueService.round2(acc.company),
        accumulated_koc_gross: RevenueService.round2(acc.gross),
        accumulated_koc_tax: RevenueService.round2(acc.kocTax),
        accumulated_koc_usd: accKocUsd,
        accumulated_koc_vnd: RevenueService.round2(accKocUsd * exchangeRate),
      };
    });

    // Totals always use accumulated values
    const totals = enrichedRecords.reduce(
      (acc, r) => {
        // Intermediate records (paid in a different cycle) are excluded from Cộng dồn total
        const isIntermediate = r.paid_in_cycle_id != null && r.paid_in_cycle_id !== r.cycle_id;
        return {
          totalOriginal: acc.totalOriginal + Number(r.original_revenue_usd),
          totalCumulatedRevenue: acc.totalCumulatedRevenue + (isIntermediate ? 0 : Number(r.accumulated_revenue_usd)),
          totalUsTax: acc.totalUsTax + Number(r.accumulated_us_tax),
          totalBankFee: acc.totalBankFee + Number(r.accumulated_bank_fee),
          totalNetRevenue: acc.totalNetRevenue + Number(r.accumulated_net_revenue),
          totalCompanyShare: acc.totalCompanyShare + Number(r.accumulated_company_share),
          totalKocShareGross: acc.totalKocShareGross + Number(r.accumulated_koc_gross),
          totalKocTax: acc.totalKocTax + Number(r.accumulated_koc_tax),
          totalKocReceiveUsd: acc.totalKocReceiveUsd + Number(r.accumulated_koc_usd),
          totalKocReceiveVnd: acc.totalKocReceiveVnd + Number(r.accumulated_koc_vnd),
          totalAccumulatedKocUsd: acc.totalAccumulatedKocUsd + Number(r.accumulated_koc_usd),
          totalAccumulatedKocVnd: acc.totalAccumulatedKocVnd + Number(r.accumulated_koc_vnd),
        };
      },
      {
        totalOriginal: 0,
        totalCumulatedRevenue: 0,
        totalUsTax: 0,
        totalBankFee: 0,
        totalNetRevenue: 0,
        totalCompanyShare: 0,
        totalKocShareGross: 0,
        totalKocTax: 0,
        totalKocReceiveUsd: 0,
        totalKocReceiveVnd: 0,
        totalAccumulatedKocUsd: 0,
        totalAccumulatedKocVnd: 0,
      }
    );

    return { records: enrichedRecords, totals };
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
   * Bulk delete revenue records by IDs (all must belong to OPEN cycles)
   */
  static async bulkDeleteRecords(ids: string[]) {
    if (!ids || ids.length === 0) return { deleted: 0 };

    // Validate all records exist and belong to OPEN cycles
    const records = await prisma.revenueRecord.findMany({
      where: { id: { in: ids } },
      include: { cycle: true },
    });

    for (const record of records) {
      if (record.cycle.status !== 'OPEN') {
        throw new ApiError(400, 'revenue.cannotDeleteFromLocked');
      }
    }

    await prisma.revenueRecord.deleteMany({ where: { id: { in: ids } } });
    return { deleted: records.length };
  }

  /**
   * Approve a revenue record.
   * Approves this record AND all previous PENDING records for the same KOC
   * (since threshold was accumulated across months). paid_in_cycle_id is set
   * to the current record's cycle_id to mark where payment was finalized.
   */
  static async approveRecord(recordId: string, adminId?: string, allowedKocIds?: string[]) {
    const record = await prisma.revenueRecord.findUnique({
      where: { id: recordId },
      include: { cycle: true },
    });
    if (!record) throw new ApiError(404, 'revenue.recordNotFound');
    if (adminId && record.cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');
    if (allowedKocIds && !allowedKocIds.includes(record.koc_id)) throw new ApiError(403, 'revenue.notYours');

    // Check threshold
    const paymentStatus = await RevenueService.getPaymentStatus(record.cycle_id, adminId, allowedKocIds);
    const kocStatus = paymentStatus[record.koc_id];
    if (kocStatus?.belowThreshold) {
      throw new ApiError(400, 'revenue.belowThreshold');
    }

    // Approve pending records for this KOC in current + previous cycles only
    // Use month-based comparison to find chronologically earlier-or-equal cycles
    const prevOrEqualCycleIds = await RevenueService.getCycleIdsBefore(
      record.cycle.month, record.cycle.admin_id, true
    );
    await (prisma as any).revenueRecord.updateMany({
      where: { koc_id: record.koc_id, status: 'PENDING', cycle_id: { in: prevOrEqualCycleIds } },
      data: { status: 'APPROVED', paid_in_cycle_id: record.cycle_id },
    });

    // Return the now-approved current record
    return { ...record, status: 'APPROVED' as const, paid_in_cycle_id: record.cycle_id };
  }

  /**
   * Unapprove an APPROVED record back to PENDING.
   * Clears paid_in_cycle_id so accumulation logic picks it up again.
   */
  static async unapproveRecord(recordId: string, adminId?: string, allowedKocIds?: string[]) {
    const record = await prisma.revenueRecord.findUnique({
      where: { id: recordId },
      include: { cycle: true },
    });
    if (!record) throw new ApiError(404, 'revenue.recordNotFound');
    if (adminId && record.cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');
    if (allowedKocIds && !allowedKocIds.includes(record.koc_id)) throw new ApiError(403, 'revenue.notYours');
    if (record.status !== 'APPROVED') throw new ApiError(400, 'revenue.notApproved');

    const updated = await prisma.revenueRecord.update({
      where: { id: recordId },
      data: { status: 'PENDING', paid_in_cycle_id: null },
    });

    return updated;
  }

  /**
   * Get payment status for each record in a cycle.
   * Uses per-KOC min_payment threshold. Accumulates original_revenue_usd across months.
   * When a cycle is PAYMENT_COMPLETED, records in that cycle are considered paid → reset accumulation.
   * Returns map of koc_id -> { accumulated, belowThreshold, accumulatedMonths, threshold }
   */
  static async getPaymentStatus(cycleId: number, adminId?: string, allowedKocIds?: string[]) {
    const cycle = await prisma.revenueCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');

    // Get all cycles and sort chronologically by parsed month (not string sort)
    const allCycles = await prisma.revenueCycle.findMany();
    allCycles.sort((a, b) => RevenueService.monthToSortKey(a.month) - RevenueService.monthToSortKey(b.month));

    // Find cycles chronologically before (and including) current cycle
    const currentKey = RevenueService.monthToSortKey(cycle.month);
    const relevantCycles = allCycles.filter(c => RevenueService.monthToSortKey(c.month) <= currentKey);

    // Get all records for relevant cycles (scoped to admin's KOCs or manager's allowed KOCs)
    // Exclude INACTIVE KOCs — their revenue should not appear on UI
    const kocFilter = adminId
      ? { koc: { admin_id: adminId, status: 'ACTIVE' as const } }
      : allowedKocIds
        ? { koc_id: { in: allowedKocIds }, koc: { status: 'ACTIVE' as const } }
        : { koc: { status: 'ACTIVE' as const } };
    const records = await prisma.revenueRecord.findMany({
      where: { cycle_id: { in: relevantCycles.map(c => c.id) }, ...kocFilter },
      include: { cycle: true },
    });
    // Sort by parsed month chronologically (not string sort which breaks cross-year)
    records.sort((a, b) => RevenueService.monthToSortKey(a.cycle.month) - RevenueService.monthToSortKey(b.cycle.month));

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
    const kocRecords = new Map<string, Array<{ cycleId: number; revenue: number; month: string; status: string; cycleStatus: string; paidInCycleId: number | null }>>();
    for (const record of records) {
      const entries = kocRecords.get(record.koc_id) || [];
      entries.push({
        cycleId: record.cycle_id,
        revenue: Number(record.original_revenue_usd),
        month: record.cycle.month,
        status: record.status,
        cycleStatus: cycleStatusMap.get(record.cycle_id) || 'OPEN',
        paidInCycleId: record.paid_in_cycle_id,
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
        if (entry.status === 'APPROVED' && entry.paidInCycleId !== cycleId) {
          // Settled in a previous/different cycle → reset running total.
          accumulated = 0;
          accumulatedMonths.length = 0;
        } else {
          // PENDING or approved together in the current cycle → include in accumulated.
          accumulated += entry.revenue;
          accumulatedMonths.push({ month: entry.month, revenue: entry.revenue });
        }
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
