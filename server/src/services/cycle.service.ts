import prisma from '../config/database';
import { ApiError } from '../middlewares';
import { RevenueService } from './revenue.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export class CycleService {
  /**
   * Get all revenue cycles — scoped by admin_id
   */
  static async getAll(adminId?: string) {
    // Get admin's KOC IDs for count filtering
    const adminKocIds = adminId
      ? (await prisma.kOC.findMany({ where: { admin_id: adminId }, select: { id: true } })).map(k => k.id)
      : null;

    const cycles = await db.revenueCycle.findMany({
      where: adminId ? { admin_id: adminId } : {},
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { revenue_records: adminKocIds ? { where: { koc_id: { in: adminKocIds } } } : true } },
      },
    });

    return cycles;
  }

  /**
   * Get cycle by ID with records summary — checks admin ownership
   */
  static async getById(id: number, adminId?: string) {
    // Build record filter for admin scoping
    const adminKocIds = adminId
      ? (await prisma.kOC.findMany({ where: { admin_id: adminId }, select: { id: true } })).map(k => k.id)
      : null;

    const cycle = await db.revenueCycle.findUnique({
      where: { id },
      include: {
        revenue_records: {
          where: adminKocIds ? { koc_id: { in: adminKocIds } } : undefined,
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
  static async create(month: string, exchangeRate: number, adminId?: string) {
    // Check duplicate for this admin
    const existing = await db.revenueCycle.findFirst({
      where: { month, admin_id: adminId || null },
    });
    if (existing) throw new ApiError(409, 'cycle.alreadyExists');

    return db.revenueCycle.create({
      data: {
        month,
        exchange_rate: exchangeRate,
        admin_id: adminId || null,
      },
    });
  }

  /**
   * Update a revenue cycle — checks admin ownership
   */
  static async update(id: number, data: { exchange_rate?: number; status?: 'OPEN' | 'LOCKED' | 'PAYMENT_COMPLETED' }, adminId?: string) {
    const cycle = await db.revenueCycle.findUnique({ where: { id } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (adminId && cycle.admin_id !== adminId) throw new ApiError(403, 'cycle.notYours');

    // If updating exchange rate, recalculate all records (only this admin's)
    if (data.exchange_rate && data.exchange_rate !== Number(cycle.exchange_rate)) {
      const adminKocIds = adminId
        ? (await prisma.kOC.findMany({ where: { admin_id: adminId }, select: { id: true } })).map(k => k.id)
        : null;

      const records = await prisma.revenueRecord.findMany({
        where: {
          cycle_id: id,
          ...(adminKocIds ? { koc_id: { in: adminKocIds } } : {}),
        },
        include: { koc: true },
      });

      // Full recalculation for each record using new exchange rate
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
   * Lock a cycle (prevent further edits) — checks admin ownership
   */
  static async lock(id: number, adminId?: string) {
    return CycleService.update(id, { status: 'LOCKED' }, adminId);
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

    // For each eligible KOC: approve EVERY pending record across all cycles
    for (const [kocId, status] of Object.entries(paymentStatus)) {
      if (!status.belowThreshold) {
        // Approve ALL pending records for this KOC (previous + current cycle)
        // paid_in_cycle_id = id means "payment was made in this cycle"
        await db.revenueRecord.updateMany({
          where: { koc_id: kocId, status: 'PENDING' },
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
