import { NextFunction, Request, Response } from 'express';
import { SocialBladeService } from '../services';
import { ProgressService } from '../services/progress.service';
import { AuthenticatedRequest } from '../types';

export class StatsController {
  /**
   * GET /api/stats/:kocId
   */
  static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = req.query.days ? Number(req.query.days) : 30;
      const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;
      const stats = await SocialBladeService.getStatsHistory(kocId, days);

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('stats.retrieved') : 'Channel stats retrieved',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/stats/:kocId/fetch
   */
  static async fetchStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const record = await SocialBladeService.recordStats(kocId, adminId);

      const t = (req as any).t;
      res.status(201).json({
        success: true,
        message: t ? t('stats.fetched') : 'Channel stats fetched and saved',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/stats/fetch-all
   * Returns immediately with taskId; runs fetch in background with SSE progress.
   */
  static async fetchAllStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (_req as AuthenticatedRequest).user?.userId;
      const taskId = ProgressService.generateTaskId('stats');

      // Respond immediately with taskId
      res.status(202).json({
        success: true,
        message: 'Stats fetch started',
        data: { taskId },
      });

      // Run in background
      (async () => {
        try {
          const { GemLoginService } = await import('../services/gemlogin.service');
          await GemLoginService.ensureRunning(() =>
            ProgressService.emit(taskId, { step: 0, total: 1, percent: 0, message: 'Đang khởi động GemLogin...' })
          );
          await SocialBladeService.recordAllStatsWithProgress(taskId, adminId);
        } catch {
          // Error handled inside service
        }
      })();
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/stats/latest
   */
  static async getLatest(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (_req as AuthenticatedRequest).user?.role === 'ADMIN' ? (_req as AuthenticatedRequest).user?.userId : undefined;
      const stats = await SocialBladeService.getLatestStats(adminId);

      const t = (_req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('stats.latestRetrieved') : 'Latest stats retrieved',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/stats/:kocId/growth
   * Returns detailed YT Studio analytics for a single KOC
   */
  static async getGrowth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;
      const detail = await SocialBladeService.getKocDetail(kocId);

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('stats.growthCalculated') : 'Growth calculated',
        data: detail,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/stats/growth/all
   * Returns YT Studio analytics for all KOCs
   */
  static async getAllGrowth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (_req as AuthenticatedRequest).user?.role === 'ADMIN' ? (_req as AuthenticatedRequest).user?.userId : undefined;
      const growthData = await SocialBladeService.getAllKocsGrowth(adminId);

      const t = (_req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('stats.growthCalculated') : 'Growth calculated for all KOCs',
        data: growthData,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/stats/:kocId/correlation?months=6
   */
  static async getCorrelation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;
      const months = req.query.months ? Number(req.query.months) : 6;
      const data = await SocialBladeService.getCorrelation(kocId, months);

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('stats.correlationCalculated') : 'Correlation data calculated',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
