import { NextFunction, Request, Response } from 'express';
import prisma from '../config/database';
import { AUDIT_ACTIONS, ENTITIES } from '../constants';
import { AuditLogService, CycleService, ExchangeRateService, RevenueService } from '../services';
import { YouTubeScrapeResultService } from '../services/youtube-scrape-result.service';
import { YouTubeScraperService } from '../services/youtube-scraper.service';
import { AuthenticatedRequest } from '../types';

export class CycleController {
  /**
   * GET /api/cycles
   */
  static async getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cycles = await CycleService.getAll();

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
      const cycle = await CycleService.getById(Number(req.params.id));

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
      const { month, exchange_rate } = req.body;
      const cycle = await CycleService.create(month, exchange_rate);

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
      const cycle = await CycleService.update(Number(req.params.id), req.body);

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
      const cycle = await CycleService.lock(Number(req.params.id));

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
      const cycle = await CycleService.complete(Number(req.params.id));

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
      const cycle = await CycleService.delete(Number(req.params.id));

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
      const cycleId = Number(req.params.id);
      const cycle = await CycleService.getById(cycleId);

      if (cycle.status !== 'OPEN') {
        res.status(400).json({ success: false, message: t ? t('ytScraper.cycleNotOpen') : 'Cycle is not OPEN' });
        return;
      }

      const month = cycle.month; // "MM/YYYY"

      // Get all active KOCs
      const kocs = await prisma.kOC.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true, base_rate: true },
      });

      if (kocs.length === 0) {
        res.status(400).json({ success: false, message: t ? t('ytScraper.noActiveKocs') : 'No active KOCs found' });
        return;
      }

      // Scrape all channels (use default minus_1_month - no custom date)
      const channelIds = kocs
        .map(k => YouTubeScraperService.cleanChannelId(k.youtube_channel_id))
        .filter(id => id && id.length > 0);

      const { results: scrapeResults, errors: scrapeErrors } =
        await YouTubeScraperService.scrapeMultipleChannels(channelIds);

      // Save scrape results to DB
      const channelToKocMap = new Map<string, typeof kocs[0]>();
      for (const koc of kocs) {
        if (koc.youtube_channel_id) {
          channelToKocMap.set(YouTubeScraperService.cleanChannelId(koc.youtube_channel_id), koc);
        }
      }

      // Save scrape results
      for (const result of scrapeResults) {
        const koc = channelToKocMap.get(result.channelId);
        if (koc) {
          await YouTubeScrapeResultService.saveResult(koc.id, koc.youtube_channel_id, result);
        }
      }

      // Auto-create revenue records from scraped data
      const US_TAX_RATE = 0.30;
      const US_COUNTRY_NAMES = ['hoa kỳ', 'united states', 'us', 'usa', 'états-unis'];
      const created: Array<{ koc: string; revenue: number }> = [];
      const updated: Array<{ koc: string; revenue: number }> = [];
      const skipped: Array<{ koc: string; reason: string }> = [];

      for (const result of scrapeResults) {
        const koc = channelToKocMap.get(result.channelId);
        if (!koc) continue;

        const revenue = result.totals.estimatedRevenue;
        if (revenue == null || revenue <= 0) {
          skipped.push({ koc: koc.channel_name, reason: 'No revenue data' });
          continue;
        }

        try {
          // Calculate US tax from country breakdown: US revenue * 30%
          const countries = result.countries || [];
          const usCountry = countries.find((c: any) =>
            US_COUNTRY_NAMES.includes(c.country?.toLowerCase?.())
          );
          const usTax = usCountry?.estimatedRevenue ? usCountry.estimatedRevenue * US_TAX_RATE : 0;

          // Check if record already exists
          const existing = await prisma.revenueRecord.findUnique({
            where: { koc_id_cycle_id: { koc_id: koc.id, cycle_id: cycleId } },
          });

          if (existing) {
            // Always update to refresh pub code and latest data
            await RevenueService.updateRecord(existing.id, revenue, usTax);
            updated.push({ koc: koc.channel_name, revenue });
          } else {
            // Create new record
            await RevenueService.createRecord(koc.id, cycleId, revenue, usTax);
            created.push({ koc: koc.channel_name, revenue });
          }
        } catch (error: any) {
          skipped.push({ koc: koc.channel_name, reason: error.message });
        }
      }

      // Log audit
      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          'SCRAPE_REVENUE',
          ENTITIES.REVENUE_CYCLE,
          String(cycleId),
          null,
          { month, created: created.length, updated: updated.length, skipped: skipped.length, errors: scrapeErrors.length }
        );
      }

      res.status(200).json({
        success: true,
        message: t
          ? t('cycle.scrapeComplete', { created: created.length, updated: updated.length, skipped: skipped.length, errors: scrapeErrors.length })
          : `Scrape complete: ${created.length} created, ${updated.length} updated, ${skipped.length} skipped, ${scrapeErrors.length} errors`,
        data: {
          month,
          created,
          updated,
          skipped,
          scrapeErrors,
          summary: {
            totalKOCs: kocs.length,
            scraped: scrapeResults.length,
            recordsCreated: created.length,
            recordsUpdated: updated.length,
            recordsSkipped: skipped.length,
            scrapeFailed: scrapeErrors.length,
          },
        },
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
}
