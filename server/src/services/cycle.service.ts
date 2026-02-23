import prisma from '../config/database';
import { ApiError } from '../middlewares';
import { RevenueService } from './revenue.service';

export class CycleService {
  /**
   * Get all revenue cycles
   */
  static async getAll() {
    const cycles = await prisma.revenueCycle.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { revenue_records: true } },
      },
    });

    return cycles;
  }

  /**
   * Get cycle by ID with records summary
   */
  static async getById(id: number) {
    const cycle = await prisma.revenueCycle.findUnique({
      where: { id },
      include: {
        revenue_records: {
          include: {
            koc: {
              select: { full_name: true, channel_name: true, bank_name: true, bank_account_number: true },
            },
          },
        },
      },
    });

    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    return cycle;
  }

  /**
   * Create a new revenue cycle
   */
  static async create(month: string, exchangeRate: number) {
    const existing = await prisma.revenueCycle.findUnique({ where: { month } });
    if (existing) throw new ApiError(409, 'cycle.alreadyExists');

    return prisma.revenueCycle.create({
      data: {
        month,
        exchange_rate: exchangeRate,
      },
    });
  }

  /**
   * Update a revenue cycle
   */
  static async update(id: number, data: { exchange_rate?: number; status?: 'OPEN' | 'LOCKED' | 'PAYMENT_COMPLETED' }) {
    const cycle = await prisma.revenueCycle.findUnique({ where: { id } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');

    // If updating exchange rate, recalculate all records
    if (data.exchange_rate && data.exchange_rate !== Number(cycle.exchange_rate)) {
      const records = await prisma.revenueRecord.findMany({
        where: { cycle_id: id },
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

    return prisma.revenueCycle.update({
      where: { id },
      data,
    });
  }

  /**
   * Lock a cycle (prevent further edits)
   */
  static async lock(id: number) {
    return CycleService.update(id, { status: 'LOCKED' });
  }

  /**
   * Mark cycle as payment completed
   */
  static async complete(id: number) {
    const cycle = await prisma.revenueCycle.findUnique({ where: { id } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (cycle.status !== 'LOCKED') throw new ApiError(400, 'cycle.mustLockFirst');

    // Check all records are approved
    const pendingCount = await prisma.revenueRecord.count({
      where: { cycle_id: id, status: 'PENDING' },
    });

    if (pendingCount > 0) {
      throw new ApiError(400, 'cycle.pendingRecords');
    }

    return prisma.revenueCycle.update({
      where: { id },
      data: { status: 'PAYMENT_COMPLETED' },
    });
  }

  /**
   * Delete a cycle (only if OPEN and no records)
   */
  static async delete(id: number) {
    const cycle = await prisma.revenueCycle.findUnique({ where: { id } });
    if (!cycle) throw new ApiError(404, 'cycle.notFound');
    if (cycle.status !== 'OPEN') throw new ApiError(400, 'cycle.onlyOpenCanDelete');

    const recordCount = await prisma.revenueRecord.count({ where: { cycle_id: id } });
    if (recordCount > 0) throw new ApiError(400, 'cycle.hasRecords');

    await prisma.revenueCycle.delete({ where: { id } });
    return cycle;
  }
}
