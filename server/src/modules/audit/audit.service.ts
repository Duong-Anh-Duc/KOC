import prisma from '../../config/database';

export class AuditLogService {
  /**
   * Create audit log entry
   */
  static async log(
    userId: string | null,
    action: string,
    entity: string,
    entityId: string,
    oldValue?: Record<string, unknown> | null,
    newValue?: Record<string, unknown> | null
  ) {
    return prisma.auditLog.create({
      data: {
        user_id: userId,
        action,
        entity,
        entity_id: entityId,
        old_value: oldValue as any,
        new_value: newValue as any,
      },
    });
  }

  /**
   * Get audit logs with pagination
   */
  static async getLogs(options: {
    page?: number;
    limit?: number;
    entity?: string;
    action?: string;
    entityId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (options.entity) where.entity = options.entity;
    if (options.action) where.action = options.action;
    if (options.entityId) where.entity_id = options.entityId;
    if (options.userId) where.user_id = options.userId;

    // Date range filter (adjust for Vietnam timezone UTC+7)
    if (options.startDate || options.endDate) {
      const timestampFilter: Record<string, Date> = {};
      if (options.startDate) {
        // Start of day in UTC+7 = previous day 17:00 UTC
        timestampFilter.gte = new Date(`${options.startDate}T00:00:00.000+07:00`);
      }
      if (options.endDate) {
        // End of day in UTC+7 = current day 16:59:59 UTC
        timestampFilter.lte = new Date(`${options.endDate}T23:59:59.999+07:00`);
      }
      where.timestamp = timestampFilter;
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          user: { select: { full_name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
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
}
