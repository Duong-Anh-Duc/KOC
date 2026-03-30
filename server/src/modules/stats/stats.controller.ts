import { NextFunction, Request, Response } from 'express';
import { StatsCronService } from '../cron/cron.service';
import { ProgressService } from '../shared/progress.service';
import { AuthenticatedRequest } from '../../types';
import { SocialBladeService } from '../shared/socialblade.service';
import { getAccessScope, isKocAccessible } from '../../utils/access-scope';

export class StatsController {
  /**
   * GET /api/stats/:kocId
   */
  static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const scope = await getAccessScope(authReq);
      const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;

      if (!isKocAccessible(kocId, scope)) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const days = req.query.days ? Number(req.query.days) : 30;
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
      const authReq = req as AuthenticatedRequest;
      const scope = await getAccessScope(authReq);
      const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;

      if (!isKocAccessible(kocId, scope)) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

      const adminId = authReq.user?.userId;
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
      const authReq = _req as AuthenticatedRequest;
      const scope = await getAccessScope(authReq);
      const adminId = scope.adminId || authReq.user?.userId;
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
          const { GemLoginService } = await import('../gemlogin/gemlogin.service');
          await GemLoginService.ensureRunning(() =>
            ProgressService.emit(taskId, { step: 0, total: 1, percent: 0, message: 'Đang khởi động GemLogin...' })
          );
          await SocialBladeService.recordAllStatsWithProgress(taskId, adminId, scope.allowedKocIds);
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
      const authReq = _req as AuthenticatedRequest;
      const scope = await getAccessScope(authReq);
      const stats = await SocialBladeService.getLatestStats(scope.adminId, scope.allowedKocIds);

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
      const authReq = req as AuthenticatedRequest;
      const scope = await getAccessScope(authReq);
      const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;

      if (!isKocAccessible(kocId, scope)) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

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
      const authReq = _req as AuthenticatedRequest;
      const scope = await getAccessScope(authReq);
      const growthData = await SocialBladeService.getAllKocsGrowth(scope.adminId, scope.allowedKocIds);

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
      const authReq = req as AuthenticatedRequest;
      const scope = await getAccessScope(authReq);
      const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;

      if (!isKocAccessible(kocId, scope)) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
      }

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

  /* ============================================================
     STATS CRON CONFIG
     ============================================================ */

  /** GET /api/stats/cron-config */
  static async getCronConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await StatsCronService.getConfig();
      res.json({ success: true, data: { ...config, schedulerRunning: StatsCronService.isRunning() } });
    } catch (error) {
      next(error);
    }
  }

  /** PUT /api/stats/cron-config */
  static async updateCronConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enabled, schedule } = req.body;
      const updated = await StatsCronService.updateConfig({ enabled, schedule });
      res.json({ success: true, data: { ...updated, schedulerRunning: StatsCronService.isRunning() } });
    } catch (error) {
      next(error);
    }
  }
}
