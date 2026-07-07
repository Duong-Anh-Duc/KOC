import { NextFunction, Request, Response } from 'express';
import prisma from '../../config/database';
import { AUDIT_ACTIONS, ENTITIES } from '../../constants';
import logger from '../../middlewares/logger.middleware';
import { ProgressService } from '../shared/progress.service';
import { PubCodeService } from '../shared/pub-code.service';
import { YouTubeScrapeResultService } from '../shared/youtube-scrape-result.service';
import { YouTubeScraperService } from '../shared/youtube-scraper.service';
import { AuthenticatedRequest } from '../../types';
import { getAccessScope, buildKocWhereFilter } from '../../utils/access-scope';
import { AuditLogService } from '../audit/audit.service';
import { CycleService } from './cycle.service';
import { RevenueService } from '../revenue/revenue.service';

export class CycleActionsController {
  /**
   * PATCH /api/cycles/:id/lock
   */
  static async lock(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const scope = await getAccessScope(req);
      const cycle = await CycleService.lock(Number(req.params.id), scope.adminId);

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
   * PATCH /api/cycles/:id/lock-rate
   */
  static async lockExchangeRate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const scope = await getAccessScope(req);
      const cycle = await CycleService.lockExchangeRate(Number(req.params.id), scope.adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.LOCK_EXCHANGE_RATE,
          ENTITIES.REVENUE_CYCLE,
          String(cycle.id),
          { exchange_rate_locked: false },
          { exchange_rate_locked: true }
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.exchangeRateLocked') : 'Exchange rate locked',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/cycles/:id/unlock-rate
   */
  static async unlockExchangeRate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const scope = await getAccessScope(req);
      const cycle = await CycleService.unlockExchangeRate(Number(req.params.id), scope.adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.UNLOCK_EXCHANGE_RATE,
          ENTITIES.REVENUE_CYCLE,
          String(cycle.id),
          { exchange_rate_locked: true },
          { exchange_rate_locked: false }
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.exchangeRateUnlocked') : 'Exchange rate unlocked',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/cycles/:id/reopen
   */
  static async reopen(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const scope = await getAccessScope(req);
      const oldCycle = await CycleService.getById(Number(req.params.id), scope.adminId);
      const cycle = await CycleService.reopen(Number(req.params.id), scope.adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.REOPEN_CYCLE,
          ENTITIES.REVENUE_CYCLE,
          String(cycle.id),
          { status: oldCycle.status },
          { status: 'OPEN' }
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.reopened') : 'Revenue cycle reopened',
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
      const scope = await getAccessScope(req);
      const cycle = await CycleService.complete(Number(req.params.id), scope.adminId);

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
   * POST /api/cycles/:id/scrape-revenue
   * Scrape YouTube revenue for all active KOCs for the cycle's month,
   * then auto-create revenue records from the scraped data
   */
  static async scrapeRevenue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const scope = await getAccessScope(req);
      const cycleId = Number(req.params.id);
      const cycle = await CycleService.getById(cycleId, scope.adminId);

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
      logger.info(`Starting scrape-revenue task ${taskId} for cycle ${cycleId} (month: ${month}, admin: ${req.user?.userId}, kocIds: ${kocIds ? kocIds.length : 'all'})`);
      CycleActionsController.runScrapeRevenue(cycleId, month, taskId, req.user?.userId || null, scope, kocIds, t).catch(err => {
        logger.error(`scrape-revenue task ${taskId} failed:`, err.message, err.stack);
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
   * POST /api/cycles/:id/check-pub-codes
   * Check pub codes for all KOCs in a cycle, update revenue records
   */
  static async checkPubCodes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const scope = await getAccessScope(req);
      const cycleId = Number(req.params.id);
      const taskId = ProgressService.generateTaskId('check-pub-codes');
      res.status(202).json({
        success: true,
        message: t ? t('progress.taskStarted') : 'Task started',
        data: { taskId },
      });

      CycleActionsController.runCheckPubCodes(cycleId, taskId, req.user?.userId || null, scope.allowedKocIds, t).catch(err => {
        logger.error(`check-pub-codes task ${taskId} failed:`, err.message);
        ProgressService.error(taskId, err.message);
      });
    } catch (error) {
      next(error);
    }
  }

  private static async runCheckPubCodes(cycleId: number, taskId: string, userId: string | null, allowedKocIds?: string[], t?: (key: string, opts?: Record<string, unknown>) => string): Promise<void> {
    try {
      const { GemLoginService } = await import('../gemlogin/gemlogin.service');
      await GemLoginService.ensureRunning(() =>
        ProgressService.emit(taskId, { step: 0, total: 1, percent: 0, message: t ? t('progress.startingGemLogin') : 'Đang khởi động GemLogin...' })
      );

      // Get unique KOCs that have records in this cycle
      const records = await prisma.revenueRecord.findMany({
        where: {
          cycle_id: cycleId,
          ...(allowedKocIds ? { koc_id: { in: allowedKocIds } } : {}),
        },
        include: { koc: { select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true, pub_code: true } } },
      });

      if (records.length === 0) {
        ProgressService.complete(taskId, { total: 0, matched: 0, mismatched: 0, noData: 0, errors: 0, results: [] });
        return;
      }

      // Deduplicate: check each KOC only once
      const kocMap = new Map<string, typeof records[0]['koc']>();
      for (const r of records) {
        if (!kocMap.has(r.koc.id)) kocMap.set(r.koc.id, r.koc);
      }
      const kocs = Array.from(kocMap.values());

      ProgressService.emit(taskId, { step: 0, total: kocs.length, percent: 0, message: t ? t('progress.openingPubTabs', { count: kocs.length }) : `Mở ${kocs.length} tab kiểm tra mã Pub...` });

      const { results: pubResults, summary } = await PubCodeService.checkPubCodesParallel(
        kocs,
        userId || undefined,
        (current, total, name) => {
          ProgressService.emit(taskId, {
            step: current, total, percent: Math.round((current / total) * 100),
            message: t ? t('progress.checked', { name, current, total }) : `Đã kiểm tra: ${name} (${current}/${total})`,
          });
        },
      );

      // Update revenue records in DB
      for (const r of pubResults) {
        await prisma.revenueRecord.updateMany({
          where: { koc_id: r.kocId },
          data: { scraped_pub_code: r.scrapedPubCode, pub_code_match: r.matched },
        });
      }

      const results = pubResults.map(r => ({
        koc: r.kocName,
        stored: r.storedPubCode,
        scraped: r.scrapedPubCode,
        matched: r.matched,
        error: r.error,
      }));

      ProgressService.complete(taskId, { ...summary, results });
    } catch (error: any) {
      ProgressService.error(taskId, error.message);
    }
  }

  /**
   * Background method to run scrape revenue with progress
   */
  private static async runScrapeRevenue(cycleId: number, month: string, taskId: string, userId: string | null, scope: { adminId?: string; allowedKocIds?: string[] }, kocIds?: string[], t?: (key: string, opts?: Record<string, unknown>) => string): Promise<void> {
    try {
      const { GemLoginService } = await import('../gemlogin/gemlogin.service');
      await GemLoginService.ensureRunning(() =>
        ProgressService.emit(taskId, { step: 0, total: 1, percent: 0, message: t ? t('progress.startingGemLogin') : 'Đang khởi động GemLogin...' })
      );

      const kocs = await prisma.kOC.findMany({
        where: {
          status: 'ACTIVE',
          ...(scope.adminId ? { admin_id: scope.adminId } : {}),
          ...(scope.allowedKocIds ? { id: { in: kocIds && kocIds.length > 0 ? kocIds.filter(id => scope.allowedKocIds!.includes(id)) : scope.allowedKocIds } } : {}),
          ...(!scope.adminId && !scope.allowedKocIds && kocIds && kocIds.length > 0 ? { id: { in: kocIds } } : {}),
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
        message: t ? t('progress.startScrapingChannels', { count: channelIds.length }) : `Starting scrape for ${channelIds.length} channels...`,
      });

      const channelToKocMap = new Map<string, typeof kocs[0]>();
      for (const koc of kocs) {
        if (koc.youtube_channel_id) {
          channelToKocMap.set(YouTubeScraperService.cleanChannelId(koc.youtube_channel_id), koc);
        }
      }

      // Build channel label map (channelId → KOC name) for log file naming
      const channelLabels = new Map<string, string>();
      for (const [cId, koc] of channelToKocMap.entries()) {
        channelLabels.set(cId, koc.channel_name || koc.full_name || cId);
      }

      // Scrape channels in parallel — open one tab per KOC simultaneously
      const { results: scrapeResults, errors: scrapeErrors } =
        await YouTubeScraperService.scrapeMultipleChannelsParallel(channelIds, month, (channelId, idx, total) => {
          currentStep = idx + 1;
          const koc = channelToKocMap.get(channelId);
          const percent = Math.round((currentStep / totalSteps) * 100);
          const name = koc?.channel_name || channelId;
          ProgressService.emit(taskId, {
            step: currentStep, total: totalSteps, percent,
            message: t ? t('progress.scraping', { name, current: idx + 1, total }) : `Scraping ${name} (${idx + 1}/${total})`,
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
          message: t ? t('progress.creatingRecord', { name: koc.channel_name, current: i + 1, total: scrapeResults.length }) : `Creating record for ${koc.channel_name} (${i + 1}/${scrapeResults.length})`,
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
            await RevenueService.updateRecord(existing.id, revenue, usTax, undefined, userId || undefined);
            updated.push({ koc: koc.channel_name, revenue });
          } else {
            await RevenueService.createRecord(koc.id, cycleId, revenue, usTax, userId || undefined);
            created.push({ koc: koc.channel_name, revenue });
          }

          // ── Compute accumulated amounts for this KOC ──
          try {
            const currentRecord = await prisma.revenueRecord.findUnique({
              where: { koc_id_cycle_id: { koc_id: koc.id, cycle_id: cycleId } },
            });
            if (currentRecord) {
              const prevPending = await prisma.revenueRecord.findMany({
                where: { koc_id: koc.id, status: 'PENDING', cycle_id: { lt: cycleId } },
              });
              const accRevenue = prevPending.reduce((s, r) => s + Number(r.original_revenue_usd), 0) + Number(currentRecord.original_revenue_usd);
              const accKoc = prevPending.reduce((s, r) => s + Number(r.koc_receive_usd), 0) + Number(currentRecord.koc_receive_usd);
              await (prisma as any).revenueRecord.update({
                where: { id: currentRecord.id },
                data: { accumulated_revenue_usd: Math.round(accRevenue * 100) / 100, accumulated_koc_usd: Math.round(accKoc * 100) / 100 },
              });
            }
          } catch (accErr: any) {
            logger.warn(`Failed to compute accumulated for ${koc.channel_name}: ${accErr.message}`);
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
