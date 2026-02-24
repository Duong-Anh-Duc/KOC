import prisma from '../config/database';

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
  }) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (options.entity) where.entity = options.entity;
    if (options.action) where.action = options.action;
    if (options.entityId) where.entity_id = options.entityId;
    if (options.userId) where.user_id = options.userId;

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
