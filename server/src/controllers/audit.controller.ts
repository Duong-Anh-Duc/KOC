import { NextFunction, Request, Response } from 'express';
import { AuditLogService } from '../services';
import { AuthenticatedRequest } from '../types';

export class AuditController {
  /**
   * GET /api/audit-logs
   * Admin only sees logs from their own actions
   */
  static async getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, entity, entity_id, user_id, action } = req.query;

      const authReq = req as AuthenticatedRequest;
      // Admin: force filter to own user_id; others: allow filter param
      const effectiveUserId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : (user_id as string);

      const result = await AuditLogService.getLogs({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        entity: entity as string,
        action: action as string,
        entityId: entity_id as string,
        userId: effectiveUserId,
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
