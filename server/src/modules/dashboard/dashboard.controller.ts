import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import { getAccessScope } from '../../utils/access-scope';
import { DashboardService } from './dashboard.service';

export class DashboardController {
  /**
   * GET /api/dashboard/overview
   */
  static async getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = _req as AuthenticatedRequest;
      const scope = await getAccessScope(authReq);
      const overview = await DashboardService.getOverview(scope.adminId, scope.allowedKocIds);

      const t = (_req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('dashboard.overview') : 'Dashboard overview',
        data: overview,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/dashboard/revenue-trend
   */
  static async getRevenueTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 12;
      const authReq = req as AuthenticatedRequest;
      const scope = await getAccessScope(authReq);
      const trend = await DashboardService.getRevenueTrend(limit, scope.adminId, scope.allowedKocIds);

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('dashboard.revenueTrend') : 'Revenue trend data',
        data: trend,
      });
    } catch (error) {
      next(error);
    }
  }
}
