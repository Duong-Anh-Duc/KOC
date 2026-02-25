import { KOCStatus } from '@prisma/client';
import prisma from '../config/database';
import { PAGINATION } from '../constants';
import { ApiError } from '../middlewares';
import { PaginationQuery } from '../types';

export class KOCService {
  /**
   * Get all KOCs with pagination & search
   */
  static async getAll(query: PaginationQuery) {
    const page = query.page || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(query.limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    const where = query.search
      ? {
          OR: [
            { full_name: { contains: query.search, mode: 'insensitive' as const } },
            { channel_name: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      prisma.kOC.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'created_at']: query.sortOrder || 'desc' },
      }),
      prisma.kOC.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get KOC by ID
   */
  static async getById(id: string) {
    const koc = await prisma.kOC.findUnique({
      where: { id },
      include: {
        revenue_records: {
          include: { cycle: { select: { month: true, exchange_rate: true } } },
          orderBy: { created_at: 'desc' },
          take: 12,
        },
        channel_stats: {
          orderBy: { recorded_at: 'desc' },
          take: 30,
        },
      },
    });

    if (!koc) throw new ApiError(404, 'koc.notFound');
    return koc;
  }

  /**
   * Create a new KOC
   */
  static async create(data: {
    full_name: string;
    channel_name: string;
    youtube_channel_id: string;
    email: string;
    phone: string;
    bank_account_number: string;
    bank_name: string;
    tax_code: string;
    base_rate?: number;
    min_payment?: number;
    pub_code?: string;
  }) {
    const koc = await prisma.kOC.create({
      data: {
        full_name: data.full_name,
        channel_name: data.channel_name,
        youtube_channel_id: data.youtube_channel_id,
        email: data.email,
        phone: data.phone,
        bank_account_number: data.bank_account_number,
        bank_name: data.bank_name,
        tax_code: data.tax_code,
        base_rate: data.base_rate ?? 0.8,
        min_payment: data.min_payment ?? 100,
        pub_code: data.pub_code || null,
      },
    });

    return koc;
  }

  /**
   * Update a KOC
   */
  static async update(
    id: string,
    data: Partial<{
      full_name: string;
      channel_name: string;
      youtube_channel_id: string;
      email: string;
      phone: string;
      bank_account_number: string;
      bank_name: string;
      tax_code: string;
      base_rate: number;
      min_payment: number;
      pub_code: string;
      status: KOCStatus;
    }>
  ) {
    console.log('💾 KOCService.update - Input data:', JSON.stringify(data, null, 2));
    console.log('💾 KOCService.update - min_payment in data:', data.min_payment, 'type:', typeof data.min_payment);
    
    const existing = await prisma.kOC.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'koc.notFound');

    const oldValue = { ...existing };
    console.log('💾 KOCService.update - Old min_payment:', oldValue.min_payment);

    const updated = await prisma.kOC.update({
      where: { id },
      data,
    });
    
    console.log('💾 KOCService.update - Updated min_payment:', updated.min_payment, 'type:', typeof updated.min_payment);

    return { koc: updated, oldValue };
  }

  /**
   * Delete a KOC (soft delete by setting INACTIVE, or hard delete)
   */
  static async delete(id: string) {
    const koc = await prisma.kOC.findUnique({ where: { id } });
    if (!koc) throw new ApiError(404, 'koc.notFound');

    // Check if KOC has any revenue records
    const recordCount = await prisma.revenueRecord.count({ where: { koc_id: id } });

    if (recordCount > 0) {
      // Soft delete - set INACTIVE
      return prisma.kOC.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
    }

    // Hard delete if no records
    await prisma.kOC.delete({ where: { id } });
    return koc;
  }

  /**
   * Get all active KOCs (for dropdowns/selects)
   */
  static async getActiveKOCs() {
    return prisma.kOC.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        full_name: true,
        channel_name: true,
        base_rate: true,
      },
      orderBy: { full_name: 'asc' },
    });
  }
}
