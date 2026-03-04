import { NextFunction, Request, Response } from 'express';
import prisma from '../config/database';
import { AUDIT_ACTIONS, ENTITIES } from '../constants';
import logger from '../middlewares/logger.middleware';
import { AuditLogService, CycleService, ExchangeRateService, RevenueService } from '../services';
import { ProgressService } from '../services/progress.service';
import { YouTubeScrapeResultService } from '../services/youtube-scrape-result.service';
import { YouTubeScraperService } from '../services/youtube-scraper.service';
import { AuthenticatedRequest } from '../types';

export class CycleController {
  /**
   * GET /api/cycles
   */
  static async getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = _req as AuthenticatedRequest;
      const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
      const cycles = await CycleService.getAll(adminId);

      const t = (_req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.listRetrieved') : 'Cycles retrieved',
        data: cycles,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/cycles/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
      const cycle = await CycleService.getById(Number(req.params.id), adminId);

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.retrieved') : 'Cycle retrieved',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/cycles
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const { month, exchange_rate } = req.body;
      const cycle = await CycleService.create(month, exchange_rate, adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.CREATE_CYCLE,
          ENTITIES.REVENUE_CYCLE,
          String(cycle.id),
          null,
          cycle as unknown as Record<string, unknown>
        );
      }

      const t = (req as any).t;
      res.status(201).json({
        success: true,
        message: t ? t('cycle.created') : 'Revenue cycle created',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/cycles/:id
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const cycle = await CycleService.update(Number(req.params.id), req.body, adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.UPDATE_CYCLE,
          ENTITIES.REVENUE_CYCLE,
          String(cycle.id),
          null,
          cycle as unknown as Record<string, unknown>
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.updated') : 'Revenue cycle updated',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/cycles/:id/lock
   */
  static async lock(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const cycle = await CycleService.lock(Number(req.params.id), adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.LOCK_CYCLE,
          ENTITIES.REVENUE_CYCLE,
          String(cycle.id),
          { status: 'OPEN' },
          { status: 'LOCKED' }
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.locked') : 'Revenue cycle locked',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/cycles/:id/complete
   */
  static async complete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const cycle = await CycleService.complete(Number(req.params.id), adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.COMPLETE_CYCLE,
          ENTITIES.REVENUE_CYCLE,
          String(cycle.id),
          { status: 'LOCKED' },
          { status: 'PAYMENT_COMPLETED' }
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.completed') : 'Revenue cycle completed',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/cycles/:id
   */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const cycle = await CycleService.delete(Number(req.params.id), adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.UPDATE_CYCLE,
          ENTITIES.REVENUE_CYCLE,
          String(req.params.id),
          cycle as unknown as Record<string, unknown>,
          null
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.deleted') : 'Revenue cycle deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/cycles/exchange-rate
   * Fetch current USD/VND exchange rate from webgia.com
   */
  static async getExchangeRate(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ExchangeRateService.fetchRate();

      const t = (_req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.exchangeRateFetched') : 'Exchange rate fetched',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/cycles/:id/scrape-revenue
   * Scrape YouTube revenue for all active KOCs for the cycle's month,
   * then auto-create revenue records from the scraped data
   */
  static async scrapeRevenue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const cycleId = Number(req.params.id);
      const cycle = await CycleService.getById(cycleId, adminId);

      if (cycle.status !== 'OPEN') {
        res.status(400).json({ success: false, message: t ? t('ytScraper.cycleNotOpen') : 'Cycle is not OPEN' });
        return;
      }

      const month = cycle.month;
      const taskId = ProgressService.generateTaskId('scrape-revenue');

      // Optional: filter by specific KOC IDs
      const kocIds: string[] | undefined = req.body?.kocIds;

      // Return taskId immediately so client can subscribe to SSE
      res.status(202).json({
        success: true,
        message: t ? t('progress.taskStarted') : 'Task started',
        data: { taskId },
      });

      // Run scrape in background with progress reporting
      logger.info(`🚀 Starting scrape-revenue task ${taskId} for cycle ${cycleId} (month: ${month}, admin: ${req.user?.userId}, kocIds: ${kocIds ? kocIds.length : 'all'})`);
      CycleController.runScrapeRevenue(cycleId, month, taskId, req.user?.userId || null, kocIds).catch(err => {
        logger.error(`❌ scrape-revenue task ${taskId} failed:`, err.message, err.stack);
        ProgressService.error(taskId, err.message);
      });
    } catch (error: any) {
      const t = (req as any).t;
      if (error.message === 'NOT_LOGGED_IN') {
        res.status(401).json({
          success: false,
          message: t ? t('ytScraper.notLoggedIn') : 'Not logged in to YouTube Studio. Please login first.',
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Background method to run scrape revenue with progress
   */
  private static async runScrapeRevenue(cycleId: number, month: string, taskId: string, userId: string | null, kocIds?: string[]): Promise<void> {
    try {
      const kocs = await prisma.kOC.findMany({
        where: {
          status: 'ACTIVE',
          ...(userId ? { admin_id: userId } : {}),
          ...(kocIds && kocIds.length > 0 ? { id: { in: kocIds } } : {}),
        },
        select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true, base_rate: true },
      });

      if (kocs.length === 0) {
        ProgressService.error(taskId, 'No active KOCs found');
        return;
      }

      const channelIds = kocs
        .map(k => YouTubeScraperService.cleanChannelId(k.youtube_channel_id))
        .filter(id => id && id.length > 0);

      const totalSteps = channelIds.length + kocs.length;
      let currentStep = 0;

      ProgressService.emit(taskId, {
        step: 0, total: totalSteps, percent: 0,
        message: `Starting scrape for ${channelIds.length} channels...`,
      });

      const channelToKocMap = new Map<string, typeof kocs[0]>();
      for (const koc of kocs) {
        if (koc.youtube_channel_id) {
          channelToKocMap.set(YouTubeScraperService.cleanChannelId(koc.youtube_channel_id), koc);
        }
      }

      // Scrape channels with progress callback — pass the cycle month so correct period is scraped
      const { results: scrapeResults, errors: scrapeErrors } =
        await YouTubeScraperService.scrapeMultipleChannels(channelIds, month, (channelId, idx, total) => {
          currentStep = idx + 1;
          const koc = channelToKocMap.get(channelId);
          const percent = Math.round((currentStep / totalSteps) * 100);
          ProgressService.emit(taskId, {
            step: currentStep, total: totalSteps, percent,
            message: `Scraping ${koc?.channel_name || channelId} (${idx + 1}/${total})`,
          });
        }, userId || undefined);

      // Save scrape results to DB
      for (const result of scrapeResults) {
        const koc = channelToKocMap.get(result.channelId);
        if (koc) {
          await YouTubeScrapeResultService.saveResult(koc.id, koc.youtube_channel_id, result);
        }
      }

      // Create/update revenue records with progress
      const US_TAX_RATE = 0.30;
      const US_COUNTRY_NAMES = ['hoa kỳ', 'united states', 'us', 'usa', 'états-unis'];
      const created: Array<{ koc: string; revenue: number }> = [];
      const updated: Array<{ koc: string; revenue: number }> = [];
      const skipped: Array<{ koc: string; reason: string }> = [];

      for (let i = 0; i < scrapeResults.length; i++) {
        const result = scrapeResults[i];
        const koc = channelToKocMap.get(result.channelId);
        if (!koc) continue;

        currentStep = channelIds.length + i + 1;
        const percent = Math.round((currentStep / totalSteps) * 100);
        ProgressService.emit(taskId, {
          step: currentStep, total: totalSteps, percent,
          message: `Creating record for ${koc.channel_name} (${i + 1}/${scrapeResults.length})`,
        });

        const revenue = result.totals.estimatedRevenue;
        if (revenue == null) {
          skipped.push({ koc: koc.channel_name, reason: 'No revenue data' });
          continue;
        }

        try {
          const countries = result.countries || [];
          const usCountry = countries.find((c: any) =>
            US_COUNTRY_NAMES.includes(c.country?.toLowerCase?.())
          );
          const usTax = usCountry?.estimatedRevenue ? usCountry.estimatedRevenue * US_TAX_RATE : 0;

          const existing = await prisma.revenueRecord.findUnique({
            where: { koc_id_cycle_id: { koc_id: koc.id, cycle_id: cycleId } },
          });

          if (existing) {
            await RevenueService.updateRecord(existing.id, revenue, usTax, userId || undefined);
            updated.push({ koc: koc.channel_name, revenue });
          } else {
            await RevenueService.createRecord(koc.id, cycleId, revenue, usTax, userId || undefined);
            created.push({ koc: koc.channel_name, revenue });
          }

          // ── Compute accumulated amounts for this KOC ──
          // Previous PENDING months (other cycles) + this cycle's record
          try {
            const currentRecord = await prisma.revenueRecord.findUnique({
              where: { koc_id_cycle_id: { koc_id: koc.id, cycle_id: cycleId } },
            });
            if (currentRecord) {
              const prevPending = await prisma.revenueRecord.findMany({
                where: { koc_id: koc.id, status: 'PENDING', cycle_id: { not: cycleId } },
              });
              const accRevenue = prevPending.reduce((s, r) => s + Number(r.original_revenue_usd), 0) + Number(currentRecord.original_revenue_usd);
              const accKoc = prevPending.reduce((s, r) => s + Number(r.koc_receive_usd), 0) + Number(currentRecord.koc_receive_usd);
              await (prisma as any).revenueRecord.update({
                where: { id: currentRecord.id },
                data: { accumulated_revenue_usd: Math.round(accRevenue * 100) / 100, accumulated_koc_usd: Math.round(accKoc * 100) / 100 },
              });
            }
          } catch (accErr: any) {
            logger.warn(`⚠️ Failed to compute accumulated for ${koc.channel_name}: ${accErr.message}`);
          }
        } catch (error: any) {
          skipped.push({ koc: koc.channel_name, reason: error.message });
        }
      }

      // Audit log
      if (userId) {
        await AuditLogService.log(
          userId,
          'SCRAPE_REVENUE',
          ENTITIES.REVENUE_CYCLE,
          String(cycleId),
          null,
          { month, created: created.length, updated: updated.length, skipped: skipped.length, errors: scrapeErrors.length }
        );
      }

      // Auto-approve removed — records accumulate until manually approved by admin.
      // min_payment is only a display condition (belowThreshold flag) not a trigger.
      const autoApproved: Array<{ koc: string; accumulated: number }> = [];

      // Send final result via SSE
      ProgressService.complete(taskId, {
        month,
        created,
        updated,
        skipped,
        scrapeErrors,
        autoApproved,
        summary: {
          totalKOCs: kocs.length,
          scraped: scrapeResults.length,
          recordsCreated: created.length,
          recordsUpdated: updated.length,
          recordsSkipped: skipped.length,
          scrapeFailed: scrapeErrors.length,
          autoApproved: autoApproved.length,
        },
      });
    } catch (error: any) {
      ProgressService.error(taskId, error.message);
    }
  }
}
