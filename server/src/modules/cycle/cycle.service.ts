import prisma from '../../config/database';
import { ApiError } from '../../middlewares';
import { RevenueService } from '../revenue/revenue.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export class CycleService {
  /**
   * Get all revenue cycles — scoped by admin_id
   */
  static async getAll(adminId?: string, allowedKocIds?: string[]) {
    // Get KOC IDs for count filtering
    const scopedKocIds = adminId
      ? (await prisma.kOC.findMany({ where: { admin_id: adminId }, select: { id: true } })).map(k => k.id)
      : allowedKocIds || null;

    const cycles = await db.revenueCycle.findMany({
      where: adminId ? { admin_id: adminId } : {},
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { revenue_records: scopedKocIds ? { where: { koc_id: { in: scopedKocIds } } } : true } },
      },
    });

    return cycles;
  }

  /**
   * Get cycle by ID with records summary — checks admin ownership
   */
  static async getById(id: number, adminId?: string, allowedKocIds?: string[]) {
    // Build record filter for scoping
    const scopedKocIds = adminId
      ? (await prisma.kOC.findMany({ where: { admin_id: adminId }, select: { id: true } })).map(k => k.id)
      : allowedKocIds || null;

    const cycle = await db.revenueCycle.findUnique({
      where: { id },
      include: {
        revenue_records: {
          where: scopedKocIds ? { koc_id: { in: scopedKocIds } } : undefined,
          include: {
            koc: {
              select: { full_name: true, channel_name: true, bank_name: true, bank_account_number: true },
            },
          },
        },
      },
    });

    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (adminId && cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');
    return cycle;
  }

  /**
   * Create a new revenue cycle — tied to admin
   */
  static async create(month: string, exchangeRate: number, adminId?: string, allowedKocIds?: string[]) {
    // Check duplicate for this admin
    const existing = await db.revenueCycle.findFirst({
      where: { month, admin_id: adminId || null },
    });
    if (existing) throw new ApiError(409, 'cycle.alreadyExists');

    const cycle = await db.revenueCycle.create({
      data: {
        month,
        exchange_rate: exchangeRate,
        admin_id: adminId || null,
      },
    });

    // Auto-populate empty revenue records for all active KOCs so the table
    // shows all members immediately. Amounts are 0 and will be filled in by scraping.
    const activeKocs = await prisma.kOC.findMany({
      where: {
        status: 'ACTIVE',
        ...(adminId ? { admin_id: adminId } : {}),
        ...(allowedKocIds ? { id: { in: allowedKocIds } } : {}),
      },
      select: { id: true },
    });

    if (activeKocs.length > 0) {
      await prisma.revenueRecord.createMany({
        data: activeKocs.map(koc => ({
          koc_id: koc.id,
          cycle_id: cycle.id,
          original_revenue_usd: 0,
          us_tax_deduction: 0,
          bank_fee: 0,
          net_revenue: 0,
          company_share: 0,
          koc_share_gross: 0,
          koc_tax_deduction: 0,
          koc_receive_usd: 0,
          koc_receive_vnd: 0,
        })),
        skipDuplicates: true,
      });
    }

    return cycle;
  }

  /**
   * Update a revenue cycle — checks admin ownership
   */
  static async update(id: number, data: { exchange_rate?: number; status?: 'OPEN' | 'LOCKED' | 'PAYMENT_COMPLETED' }, adminId?: string, allowedKocIds?: string[]) {
    const cycle = await db.revenueCycle.findUnique({ where: { id } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (adminId && cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');

    // If updating exchange rate, recalculate only PENDING records (APPROVED records keep their rate)
    if (data.exchange_rate && data.exchange_rate !== Number(cycle.exchange_rate)) {
      const scopedKocIds = adminId
        ? (await prisma.kOC.findMany({ where: { admin_id: adminId }, select: { id: true } })).map(k => k.id)
        : allowedKocIds || null;

      const records = await prisma.revenueRecord.findMany({
        where: {
          cycle_id: id,
          status: 'PENDING', // Only recalculate PENDING records; APPROVED keep their rate
          ...(scopedKocIds ? { koc_id: { in: scopedKocIds } } : {}),
        },
        include: { koc: true },
      });

      // Full recalculation for each PENDING record using new exchange rate
      for (const record of records) {
        const calculated = RevenueService.calculate({
          originalRevenueUsd: Number(record.original_revenue_usd),
          usTaxDeduction: Number(record.us_tax_deduction),
          baseRate: Number(record.koc.base_rate),
          exchangeRate: data.exchange_rate,
        });

        await prisma.revenueRecord.update({
          where: { id: record.id },
          data: calculated,
        });
      }
    }

    return db.revenueCycle.update({
      where: { id },
      data,
    });
  }

  /**
   * Add KOC(s) to an existing cycle with empty ($0) revenue records.
   * If kocIds is omitted, adds ALL active KOCs not yet in the cycle.
   * Already-added KOCs are silently skipped (no duplicate error).
   */
  static async addKocs(cycleId: number, kocIds?: string[], adminId?: string, allowedKocIds?: string[]) {
    const cycle = await db.revenueCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (adminId && cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');
    if (cycle.status !== 'OPEN') throw new ApiError(400, 'revenue.cycleLocked');

    // Determine target KOCs
    // Intersect kocIds with allowedKocIds if both present
    let effectiveKocIds = kocIds;
    if (allowedKocIds) {
      effectiveKocIds = kocIds && kocIds.length > 0
        ? kocIds.filter(id => allowedKocIds.includes(id))
        : allowedKocIds;
    }
    const targetKocs = await prisma.kOC.findMany({
      where: {
        status: 'ACTIVE',
        ...(adminId ? { admin_id: adminId } : {}),
        ...(effectiveKocIds && effectiveKocIds.length > 0 ? { id: { in: effectiveKocIds } } : {}),
      },
      select: { id: true },
    });

    if (targetKocs.length === 0) return { added: 0, skipped: 0 };

    // Find which ones are already in the cycle
    const existing = await prisma.revenueRecord.findMany({
      where: { cycle_id: cycleId, koc_id: { in: targetKocs.map(k => k.id) } },
      select: { koc_id: true },
    });
    const existingIds = new Set(existing.map(r => r.koc_id));
    const toAdd = targetKocs.filter(k => !existingIds.has(k.id));

    if (toAdd.length > 0) {
      await prisma.revenueRecord.createMany({
        data: toAdd.map(koc => ({
          koc_id: koc.id,
          cycle_id: cycleId,
          original_revenue_usd: 0,
          us_tax_deduction: 0,
          bank_fee: 0,
          net_revenue: 0,
          company_share: 0,
          koc_share_gross: 0,
          koc_tax_deduction: 0,
          koc_receive_usd: 0,
          koc_receive_vnd: 0,
        })),
        skipDuplicates: true,
      });
    }

    return { added: toAdd.length, skipped: existingIds.size };
  }

  /**
   * Lock exchange rate for a cycle — prevents auto-refresh from updating rate
   */
  static async lockExchangeRate(id: number, adminId?: string) {
    const cycle = await db.revenueCycle.findUnique({ where: { id } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (adminId && cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');
    if (cycle.exchange_rate_locked) throw new ApiError(400, 'cycle.exchangeRateAlreadyLocked');
    return db.revenueCycle.update({ where: { id }, data: { exchange_rate_locked: true } });
  }

  /**
   * Unlock exchange rate for a cycle — allows auto-refresh to update rate again
   */
  static async unlockExchangeRate(id: number, adminId?: string) {
    const cycle = await db.revenueCycle.findUnique({ where: { id } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (adminId && cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');
    if (!cycle.exchange_rate_locked) throw new ApiError(400, 'cycle.exchangeRateNotLocked');
    return db.revenueCycle.update({ where: { id }, data: { exchange_rate_locked: false } });
  }

  /**
   * Lock a cycle (prevent further edits) — checks admin ownership
   */
  static async lock(id: number, adminId?: string) {
    return CycleService.update(id, { status: 'LOCKED' }, adminId);
  }

  /**
   * Reopen a LOCKED or PAYMENT_COMPLETED cycle back to OPEN — checks admin ownership
   */
  static async reopen(id: number, adminId?: string) {
    const cycle = await db.revenueCycle.findUnique({ where: { id } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (adminId && cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');
    if (cycle.status === 'OPEN') throw new ApiError(400, 'cycle.alreadyOpen');
    return db.revenueCycle.update({ where: { id }, data: { status: 'OPEN' } });
  }

  /**
   * Mark cycle as payment completed — checks admin ownership.
   * Approves ALL PENDING records (current + previous cycles) for KOCs that have
   * reached their min_payment threshold. Below-threshold KOCs stay PENDING and
   * will keep accumulating to the next cycle.
   */
  static async complete(id: number, adminId?: string) {
    const cycle = await db.revenueCycle.findUnique({ where: { id } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (adminId && cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');
    if (cycle.status !== 'LOCKED') throw new ApiError(400, 'cycle.mustLockFirst');

    // Determine which KOCs have hit the threshold (accumulated >= min_payment)
    const paymentStatus = await RevenueService.getPaymentStatus(id, adminId);

    // Find all cycle IDs chronologically before or equal to this cycle (by month, not by ID)
    const allCycles = await db.revenueCycle.findMany({
      where: cycle.admin_id ? { admin_id: cycle.admin_id } : {},
      select: { id: true, month: true },
    });
    const parseMonth = (m: string) => { const [mm, yyyy] = m.split('/'); return parseInt(yyyy, 10) * 100 + parseInt(mm, 10); };
    const currentKey = parseMonth(cycle.month);
    const prevOrEqualCycleIds = allCycles
      .filter((c: { month: string }) => parseMonth(c.month) <= currentKey)
      .map((c: { id: number }) => c.id);

    // For each eligible KOC: approve EVERY pending record across all chronologically previous cycles
    for (const [kocId, status] of Object.entries(paymentStatus)) {
      if (!status.belowThreshold) {
        // Approve pending records for this KOC (previous + current cycle only)
        // paid_in_cycle_id = id means "payment was made in this cycle"
        await db.revenueRecord.updateMany({
          where: { koc_id: kocId, status: 'PENDING', cycle_id: { in: prevOrEqualCycleIds } },
          data: { status: 'APPROVED', paid_in_cycle_id: id },
        });
      }
    }

    return db.revenueCycle.update({
      where: { id },
      data: { status: 'PAYMENT_COMPLETED' },
    });
  }

  /**
   * Delete a cycle (only if OPEN and no records) — checks admin ownership
   */
  static async delete(id: number, adminId?: string) {
    const cycle = await db.revenueCycle.findUnique({ where: { id } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (adminId && cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');
    if (cycle.status !== 'OPEN') throw new ApiError(400, 'cycle.onlyOpenCanDelete');

    const recordCount = await prisma.revenueRecord.count({ where: { cycle_id: id } });
    if (recordCount > 0) throw new ApiError(400, 'cycle.hasRecords');

    await db.revenueCycle.delete({ where: { id } });
    return cycle;
  }
}
