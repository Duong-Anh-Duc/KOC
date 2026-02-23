import { NextFunction, Request, Response } from 'express';
import { AuditLogService } from '../services';

export class AuditController {
  /**
   * GET /api/audit-logs
   */
  static async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, entity, entity_id, user_id } = req.query;

      const result = await AuditLogService.getLogs({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        entity: entity as string,
        entityId: entity_id as string,
        userId: user_id as string,
      });

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('audit.retrieved') : 'Audit logs retrieved',
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
}
