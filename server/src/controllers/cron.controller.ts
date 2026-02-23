import { NextFunction, Request, Response } from 'express';
import { AuditLogService } from '../services';
import { CronService } from '../services/cron.service';
import { AuthenticatedRequest } from '../types';

export class CronController {
  /**
   * GET /api/cron/config
   * Get current cron configuration
   */
  static async getConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await CronService.getConfig();
      const status = CronService.getSchedulerStatus();

      const t = (_req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cron.configRetrieved') : 'Cron configuration retrieved',
        data: {
          ...config,
          schedulerRunning: status.running,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/cron/config
   * Update cron configuration
   */
  static async updateConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { enabled, schedule, autoCreateCycle, autoScrapeRevenue } = req.body;

      const oldConfig = await CronService.getConfig();
      const newConfig = await CronService.updateConfig({
        ...(enabled !== undefined && { enabled }),
        ...(schedule !== undefined && { schedule }),
        ...(autoCreateCycle !== undefined && { autoCreateCycle }),
        ...(autoScrapeRevenue !== undefined && { autoScrapeRevenue }),
      });

      // Audit log (non-blocking)
      try {
        await AuditLogService.log(
          req.user?.userId || null,
          'UPDATE_CRON_CONFIG',
          'SYSTEM_CONFIG',
          'cron_auto_cycle',
          oldConfig as unknown as Record<string, unknown>,
          newConfig as unknown as Record<string, unknown>
        );
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError);
      }

      const status = CronService.getSchedulerStatus();
      const t = (req as any).t;

      res.status(200).json({
        success: true,
        message: t ? t('cron.configUpdated') : 'Cron configuration updated',
        data: {
          ...newConfig,
          schedulerRunning: status.running,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/cron/run
   * Manually trigger the cron job
   */
  static async runNow(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;

      const result = await CronService.runJob();

      // Audit log (non-blocking)
      try {
        await AuditLogService.log(
          req.user?.userId || null,
          'RUN_CRON_JOB',
          'SYSTEM_CONFIG',
          'cron_auto_cycle',
          null,
          result as unknown as Record<string, unknown>
        );
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError);
      }

      res.status(200).json({
        success: result.success,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/cron/history
   * Get cron run history
   */
  static async getHistory(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await CronService.getConfig();
      const t = (_req as any).t;

      res.status(200).json({
        success: true,
        message: t ? t('cron.historyRetrieved') : 'Cron history retrieved',
        data: {
          lastRunAt: config.lastRunAt || null,
          lastRunResult: config.lastRunResult || null,
          runHistory: config.runHistory || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/cron/next-month
   * Preview what the next auto-cycle would create
   */
  static async previewNextRun(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetMonth, canRun, reason } = await CronService.getNextCycleMonth();
      const config = await CronService.getConfig();
      const t = (_req as any).t;

      res.status(200).json({
        success: true,
        message: t ? t('cron.previewRetrieved') : 'Preview retrieved',
        data: {
          targetMonth,
          canRun,
          reason,
          config: {
            enabled: config.enabled,
            schedule: config.schedule,
            autoCreateCycle: config.autoCreateCycle,
            autoScrapeRevenue: config.autoScrapeRevenue,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
