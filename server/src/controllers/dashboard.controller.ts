import { NextFunction, Request, Response } from 'express';
import { DashboardService } from '../services';

export class DashboardController {
  /**
   * GET /api/dashboard/overview
   */
  static async getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await DashboardService.getOverview();

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
      const trend = await DashboardService.getRevenueTrend(limit);

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
