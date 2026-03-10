import { NextFunction, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../config/database';
import logger from '../middlewares/logger.middleware';
import { CycleService, RevenueService, SocialBladeService } from '../services';
import { MonthlyRevenueService } from '../services/monthly-revenue.service';
import { ProgressService } from '../services/progress.service';
import { PubCodeService } from '../services/pub-code.service';
import { YouTubeScrapeResultService } from '../services/youtube-scrape-result.service';
import { YouTubeScraperSchedulerService } from '../services/youtube-scraper-scheduler.service';
import { YouTubeScraperService } from '../services/youtube-scraper.service';
import { AuthenticatedRequest } from '../types';

export class YouTubeScraperController {
  /**
   * POST /api/yt-scraper/login
   * Open browser for manual Google login
   */
  static async openLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const result = await YouTubeScraperService.openLoginBrowser(adminId);
      const t = (req as any).t;
      res.status(200).json({ success: true, message: result.message, data: { vncUrl: result.vncUrl } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/yt-scraper/status
   * Check login status
   */
  static async checkStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const status = await YouTubeScraperService.checkLoginStatus(adminId);
      // Also sync to DB
      let disconnectInfo: { disconnected_at?: Date | null; disconnect_reason?: string | null; disconnect_url?: string | null } = {};
      if (adminId) {
        const session = await prisma.youTubeSession.upsert({
          where: { admin_id: adminId },
          create: {
            admin_id: adminId,
            is_logged_in: status.loggedIn,
            account_email: status.email || null,
            account_name: status.channelName || null,
            chrome_profile: adminId,
            verified_at: status.loggedIn ? new Date() : null,
          },
          update: {
            is_logged_in: status.loggedIn,
            account_email: status.email || null,
            account_name: status.channelName || null,
            ...(status.loggedIn ? { verified_at: new Date(), disconnected_at: null, disconnect_reason: null, disconnect_url: null } : {}),
          },
        }).catch(() => null);
        if (session && !status.loggedIn) {
          disconnectInfo = {
            disconnected_at: session.disconnected_at,
            disconnect_reason: session.disconnect_reason,
            disconnect_url: session.disconnect_url,
          };
        }
      }
      res.status(200).json({ success: true, data: { ...status, ...disconnectInfo } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/verify-session
   * Close login browser and verify session with headless Playwright
   */
  static async verifySession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const result = await YouTubeScraperService.openVerifyTab(adminId);
      // Sync to DB
      if (adminId) {
        await prisma.youTubeSession.upsert({
          where: { admin_id: adminId },
          create: {
            admin_id: adminId,
            is_logged_in: result.loggedIn,
            account_email: result.email || null,
            account_name: result.channelName || null,
            chrome_profile: adminId,
            verified_at: result.loggedIn ? new Date() : null,
          },
          update: {
            is_logged_in: result.loggedIn,
            account_email: result.email || null,
            account_name: result.channelName || null,
            ...(result.loggedIn ? { verified_at: new Date() } : {}),
          },
        }).catch(() => {});
      }
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/import-cookies
   * Import cookies from user's local browser to establish YouTube session (alternative to VNC)
   */
  static async importCookies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const { cookies } = req.body;

      if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
        res.status(400).json({ success: false, message: 'Cookies array is required' });
        return;
      }

      const result = await YouTubeScraperService.importCookies(cookies, adminId);

      // Sync to DB
      if (adminId) {
        await prisma.youTubeSession.upsert({
          where: { admin_id: adminId },
          create: {
            admin_id: adminId,
            is_logged_in: result.loggedIn,
            account_email: result.email || null,
            account_name: result.channelName || null,
            chrome_profile: adminId,
            verified_at: result.loggedIn ? new Date() : null,
          },
          update: {
            is_logged_in: result.loggedIn,
            account_email: result.email || null,
            account_name: result.channelName || null,
            ...(result.loggedIn ? { verified_at: new Date() } : {}),
          },
        }).catch(() => {});
      }

      if (result.loggedIn) {
        res.status(200).json({
          success: true,
          message: 'Import cookie thành công! Đã kết nối YouTube.',
          data: result,
        });
      } else {
        res.status(200).json({
          success: false,
          message: 'Cookie không hợp lệ hoặc đã hết hạn. Vui lòng export lại cookie mới từ trình duyệt.',
          data: result,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/sync-from-chrome
   * Auto-sync cookies from local Chrome (no extension needed)
   */
  static async syncFromChrome(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const { cdpUrl } = req.body;
      const result = await YouTubeScraperService.syncFromChrome(cdpUrl, adminId);

      if (adminId && result.loggedIn) {
        await prisma.youTubeSession.upsert({
          where: { admin_id: adminId },
          create: {
            admin_id: adminId,
            is_logged_in: true,
            account_email: result.email || null,
            account_name: result.channelName || null,
            chrome_profile: adminId,
            verified_at: new Date(),
          },
          update: {
            is_logged_in: true,
            account_email: result.email || null,
            account_name: result.channelName || null,
            verified_at: new Date(),
          },
        }).catch(() => {});
      }

      if (result.loggedIn) {
        res.status(200).json({ success: true, message: 'Đồng bộ cookie từ Chrome thành công!', data: result });
      } else {
        res.status(200).json({ success: false, message: 'Chrome chưa đăng nhập YouTube Studio. Vui lòng đăng nhập vào Chrome trước.', data: result });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/scrape-all
   * Scrape analytics for all active KOCs
   */
  static async scrapeAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const authReq = req as AuthenticatedRequest;
      const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
      // ADMIN chỉ scrape KOC của mình
      const kocWhere = adminId
        ? { status: 'ACTIVE' as const, admin_id: adminId }
        : { status: 'ACTIVE' as const };
      const kocs = await prisma.kOC.findMany({
        where: kocWhere,
        select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true },
      });

      const channelIds = kocs.map(k => YouTubeScraperService.cleanChannelId(k.youtube_channel_id));
      const taskId = ProgressService.generateTaskId('scrape-data');

      res.status(202).json({
        success: true,
        message: t ? t('progress.taskStarted') : 'Task started',
        data: { taskId },
      });

      // Run in background
      logger.info(`🚀 Starting scrape-all task ${taskId} for ${channelIds.length} channels (admin: ${adminId})`);
      YouTubeScraperController.runScrapeAll(kocs, channelIds, taskId, adminId).catch(err => {
        logger.error(`❌ scrape-all task ${taskId} failed:`, err.message, err.stack);
        ProgressService.error(taskId, err.message);
      });
    } catch (error: any) {
      const t = (req as any).t;
      if (error.message === 'NOT_LOGGED_IN') {
        res.status(403).json({
          success: false,
          message: t ? t('ytScraper.notLoggedIn') : 'Not logged in to YouTube Studio. Please use /api/yt-scraper/login first.',
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Background method to scrape all channels with progress
   */
  private static async runScrapeAll(
    kocs: Array<{ id: string; full_name: string; channel_name: string; youtube_channel_id: string }>,
    channelIds: string[],
    taskId: string,
    adminId?: string,
  ): Promise<void> {
    try {
      const { results, errors } = await YouTubeScraperService.scrapeMultipleChannels(channelIds, undefined, (channelId, idx, total) => {
        const koc = kocs.find(k => YouTubeScraperService.cleanChannelId(k.youtube_channel_id) === channelId);
        const percent = Math.round(((idx + 1) / total) * 100);
        ProgressService.emit(taskId, {
          step: idx + 1, total, percent,
          message: `Scraping ${koc?.channel_name || channelId} (${idx + 1}/${total})`,
        });
      }, adminId);

      // Map results back to KOC info & save
      const enrichedResults = results.map(r => {
        const koc = kocs.find(k => YouTubeScraperService.cleanChannelId(k.youtube_channel_id) === r.channelId);
        return { koc, analytics: r };
      });

      const batchItems = enrichedResults
        .filter(r => r.koc)
        .map(r => ({
          kocId: r.koc!.id,
          channelId: r.koc!.youtube_channel_id,
          analytics: r.analytics,
        }));
      await YouTubeScrapeResultService.saveBatchResults(batchItems);

      ProgressService.complete(taskId, {
        results: enrichedResults,
        errors,
        summary: {
          total: kocs.length,
          success: results.length,
          failed: errors.length,
        },
      });
    } catch (error: any) {
      ProgressService.error(taskId, error.message);
    }
  }

  /**
   * POST /api/yt-scraper/close
   * Close the browser instance
   */
  static async closeBrowser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const adminId = (req as AuthenticatedRequest).user?.userId;
      await YouTubeScraperService.closeBrowser(adminId);
      res.status(200).json({ success: true, message: t ? t('ytScraper.browserClosed') : 'Browser closed' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/reset-session
   * Reset (delete) saved Chrome session so user can log in with a different account
   */
  static async resetSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const adminId = (req as AuthenticatedRequest).user?.userId;
      await YouTubeScraperService.resetSession(adminId);
      res.status(200).json({ success: true, message: t ? t('ytScraper.sessionReset') : 'Session reset successfully. Please log in again.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/refresh-account-info
   * Extract and return the connected YouTube account info (channel name, email)
   */
  static async refreshAccountInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const info = await YouTubeScraperService.extractAndCacheAccountInfo(adminId);
      res.status(200).json({ success: true, data: info });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/scrape-all-async
   * Start async batch scrape job (returns immediately with jobId)
   */
  static async scrapeAllAsync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const authReq = req as AuthenticatedRequest;
      const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
      // ADMIN chỉ scrape KOC của mình
      const kocWhere = adminId
        ? { status: 'ACTIVE' as const, admin_id: adminId }
        : { status: 'ACTIVE' as const };
      const kocs = await prisma.kOC.findMany({
        select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true },
        where: kocWhere,
      });

      const channelIds = kocs
        .map((k: any) => YouTubeScraperService.cleanChannelId(k.youtube_channel_id))
        .filter((id: any) => id && id.length > 0) as string[];

      if (channelIds.length === 0) {
        res.status(400).json({ success: false, message: t ? t('ytScraper.noActiveKocs') : 'No active KOCs with YouTube channel IDs' });
        return;
      }

      const channelToKocMap = new Map<string, string>();
      for (const koc of kocs) {
        if (koc.youtube_channel_id) {
          channelToKocMap.set(YouTubeScraperService.cleanChannelId(koc.youtube_channel_id), koc.id);
        }
      }

      const { jobId, message } = await YouTubeScraperSchedulerService.startAsyncScrapeJob(
        channelIds,
        channelToKocMap,
        adminId
      );
      res.status(202).json({
        success: true,
        message,
        data: { jobId, channelCount: channelIds.length },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/yt-scraper/job/:jobId
   * Get scrape job status
   */
  static async getJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const jobId = req.params.jobId as string;
      const job = YouTubeScraperSchedulerService.getJobStatus(jobId);

      if (!job) {
        res.status(404).json({ success: false, message: t ? t('ytScraper.jobNotFound') : 'Job not found' });
        return;
      }

      res.status(200).json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/auto-connect
   * Try to auto-connect to YouTube Studio using existing session
   */
  static async autoConnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const hasSession = YouTubeScraperService.hasValidSession(adminId);
      if (hasSession) {
        res.status(200).json({
          success: true,
          message: t ? t('ytScraper.autoConnectSuccess') : '✅ Kết nối ẩn thành công - Sẵn sàng cào dữ liệu',
          data: { loggedIn: true, sessionValid: true },
        });
      } else {
        res.status(200).json({
          success: false,
          message: t ? t('ytScraper.autoConnectFailed') : '❌ Chưa có session. Vui lòng mở trình duyệt để đăng nhập Google.',
          data: { loggedIn: false, sessionValid: false },
        });
      }
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // SCRAPE RESULTS ENDPOINTS
  // ============================================================

  /**
   * GET /api/yt-scraper/results/latest
   * Get latest scrape result for each active KOC
   */
  static async getLatestResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const results = await YouTubeScrapeResultService.getLatestForAllKOCs();
      res.status(200).json({
        success: true,
        message: t ? t('ytScraper.latestResultsFound', { count: results.length }) : `Found latest scrape data for ${results.length} KOCs`,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/yt-scraper/results/:kocId
   * Get scrape history for a specific KOC
   */
  static async getKOCHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const kocId = req.params.kocId as string;
      const limit = parseInt(req.query.limit as string) || 20;
      const history = await YouTubeScrapeResultService.getHistoryByKOC(kocId, limit);
      res.status(200).json({
        success: true,
        message: t ? t('ytScraper.historyFound', { count: history.length }) : `Found ${history.length} scrape records`,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/yt-scraper/results/:kocId/latest
   * Get latest single scrape for a specific KOC
   */
  static async getKOCLatest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const kocId = req.params.kocId as string;
      const result = await YouTubeScrapeResultService.getLatestByKOC(kocId);
      if (!result) {
        res.status(404).json({ success: false, message: t ? t('ytScraper.noScrapeData') : 'No scrape data found for this KOC' });
        return;
      }
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/create-revenue-records
   * Create revenue records from latest scraped data for a given cycle
   * Body: { cycleId: number }
   */
  static async createRevenueRecords(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const adminId = req.user?.userId;
      const { cycleId } = req.body;
      if (!cycleId) {
        res.status(400).json({ success: false, message: t ? t('validation.cycleIdRequired') : 'cycleId is required' });
        return;
      }

      // Validate cycle exists and is OPEN
      const cycle = await CycleService.getById(cycleId);
      if (cycle.status !== 'OPEN') {
        res.status(400).json({ success: false, message: t ? t('ytScraper.cycleNotOpen') : 'Cycle is not OPEN' });
        return;
      }

      // Get latest scrape results for all active KOCs
      const scrapeResults = await YouTubeScrapeResultService.getLatestForAllKOCs();

      const US_TAX_RATE = 0.30;
      const US_COUNTRY_NAMES = ['hoa kỳ', 'united states', 'us', 'usa', 'états-unis'];
      const created: Array<{ koc: string; revenue: number }> = [];
      const skipped: Array<{ koc: string; reason: string }> = [];

      for (const result of scrapeResults) {
        const revenue = result.estimated_revenue;
        const kocName = result.channel_name || result.full_name || 'Unknown';

        if (revenue == null) {
          skipped.push({ koc: kocName, reason: 'No revenue data' });
          continue;
        }

        try {
          // Check if record already exists
          const existing = await prisma.revenueRecord.findUnique({
            where: { koc_id_cycle_id: { koc_id: result.koc_id, cycle_id: cycleId } },
          });

          if (existing) {
            skipped.push({ koc: kocName, reason: 'Record already exists' });
            continue;
          }

          // Calculate US tax from country breakdown: US revenue * 30%
          const countries = Array.isArray(result.country_data) ? result.country_data : [];
          const usCountry = countries.find((c: any) =>
            US_COUNTRY_NAMES.includes(c.country?.toLowerCase?.())
          );
          const usTax = usCountry?.estimatedRevenue ? usCountry.estimatedRevenue * US_TAX_RATE : 0;
          await RevenueService.createRecord(result.koc_id, cycleId, revenue, usTax, adminId);
          created.push({ koc: kocName, revenue });
        } catch (error: any) {
          skipped.push({ koc: kocName, reason: error.message });
        }
      }

      res.status(200).json({
        success: true,
        message: t ? t('ytScraper.recordsCreated', { created: created.length, skipped: skipped.length }) : `Created ${created.length} records, skipped ${skipped.length}`,
        data: {
          month: cycle.month,
          created,
          skipped,
          summary: {
            totalKOCs: scrapeResults.length,
            recordsCreated: created.length,
            recordsSkipped: skipped.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/yt-scraper/test-parse/:channelId
   * Test parse a channel and save debug info to file
   */
  static async testParse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const channelId = Array.isArray(req.params.channelId) ? req.params.channelId[0] : req.params.channelId;
      
      // Call the service method that returns analytics data
      const analytics = await SocialBladeService.scrapeChannelStats(channelId, adminId);

      // Save to file
      const outputPath = path.join(process.cwd(), 'test-parse-output.json');
      const debugData = {
        channelId,
        scrapedAt: analytics.scrapedAt,
        parsedData: {
          byCountry: analytics.byCountry,
          byDay: analytics.byDay,
        },
      };

      fs.writeFileSync(outputPath, JSON.stringify(debugData, null, 2), 'utf-8');

      res.status(200).json({
        success: true,
        message: t ? t('ytScraper.parseTestCompleted', { path: outputPath }) : `Parse test completed. Output saved to: ${outputPath}`,
        data: debugData,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==============================================================
  // MONTHLY REVENUE ANALYTICS
  // ==============================================================

  /**
   * POST /api/yt-scraper/monthly/scrape/:kocId
   * Scrape monthly revenue analytics for a specific KOC
   */
  static async scrapeMonthlyRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const kocId = req.params.kocId as string;
      const koc = await prisma.kOC.findUnique({
        where: { id: kocId },
        select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true },
      });

      if (!koc) {
        res.status(404).json({ success: false, message: t ? t('ytScraper.kocNotFound') : 'KOC not found' });
        return;
      }

      const data = await MonthlyRevenueService.scrapeAndSave(koc.id, koc.youtube_channel_id, adminId);

      res.status(200).json({
        success: true,
        data: {
          koc: { id: koc.id, name: koc.full_name, channel: koc.channel_name },
          monthCount: data.months.length,
          totals: data.totals,
          months: data.months,
          scrapedAt: data.scrapedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/monthly/scrape-all
   * Start background scrape of monthly revenue for all active KOCs.
   * Returns taskId immediately; client subscribes to SSE for progress.
   */
  static async scrapeAllMonthlyRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const kocIds: string[] | undefined = req.body?.kocIds;
      const taskId = ProgressService.generateTaskId('monthly-scrape-all');

      res.status(202).json({
        success: true,
        message: t ? t('progress.taskStarted') : 'Task started',
        data: { taskId },
      });

      // Run in background with progress
      (async () => {
        try {
          const { results, errors } = await MonthlyRevenueService.scrapeAllKOCs(
            adminId,
            (current, total, channelName) => {
              ProgressService.emit(taskId, {
                step: current,
                total,
                percent: Math.round((current / total) * 100),
                message: `[${current}/${total}] Đang cào: ${channelName}`,
              });
            },
            kocIds
          );
          ProgressService.complete(taskId, { results, errors, total: results.length + errors.length });
        } catch (err: any) {
          logger.error(`monthly-scrape-all task ${taskId} failed:`, err.message);
          ProgressService.error(taskId, err.message);
        }
      })();
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/yt-scraper/monthly/:kocId
   * Get stored monthly revenue analytics for a KOC
   */
  static async getMonthlyRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const kocId = req.params.kocId as string;
      const data = await MonthlyRevenueService.getByKOC(kocId);
      res.status(200).json({ success: true, message: t ? t('ytScraper.monthlyDataRetrieved') : 'Monthly revenue data retrieved', data });
    } catch (error) {
      next(error);
    }
  }

  // ==============================================================
  // PUB CODE VERIFICATION
  // ==============================================================

  /**
   * POST /api/yt-scraper/verify-pub-code/:kocId
   * Scrape monetization page and verify pub code for a specific KOC
   */
  static async verifyPubCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const kocId = req.params.kocId as string;
      const result = await PubCodeService.verifyKOCPubCode(kocId, adminId);

      const success = result.matched !== false;
      res.status(200).json({
        success,
        message: result.matched === true
          ? (t ? t('pubCode.matched') : `Pub code matched: ${result.scrapedPubCode}`)
          : result.matched === false
            ? (t ? t('pubCode.mismatched', { stored: result.storedPubCode, scraped: result.scrapedPubCode }) : `Pub code MISMATCH! Stored: ${result.storedPubCode}, Scraped: ${result.scrapedPubCode}`)
            : (t ? t('pubCode.noData') : 'Could not verify pub code'),
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/verify-pub-codes
   * Verify pub codes for all active KOCs
   */
  static async verifyAllPubCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const adminId = (req as AuthenticatedRequest).user?.userId;
      const { results, summary } = await PubCodeService.verifyAllPubCodes(adminId);
      res.status(200).json({
        success: true,
        message: t
          ? t('pubCode.verifyAllResult', summary)
          : `Verified ${summary.total} KOCs: ${summary.matched} matched, ${summary.mismatched} mismatched, ${summary.noData} no data, ${summary.errors} errors`,
        data: { results, summary },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/yt-scraper/auto-login-config
   * Save Google credentials for auto-login
   */
  static async saveAutoLoginConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as AuthenticatedRequest).user?.userId;
      if (!adminId) { res.status(403).json({ success: false, message: 'Admin required' }); return; }

      const { email, password, enabled } = req.body;

      const updateData: Record<string, unknown> = {};
      if (typeof enabled === 'boolean') updateData.auto_login_enabled = enabled;
      if (email !== undefined) updateData.google_email = email || null;
      if (password !== undefined) {
        updateData.google_password_enc = password ? YouTubeScraperService.encryptPassword(password) : null;
      }

      await prisma.youTubeSession.upsert({
        where: { admin_id: adminId },
        create: { admin_id: adminId, is_logged_in: false, chrome_profile: adminId, ...updateData },
        update: updateData,
      });

      res.status(200).json({ success: true, message: 'Đã lưu cấu hình tự động đăng nhập' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/yt-scraper/auto-login-config
   * Get current auto-login config (without password)
   */
  static async getAutoLoginConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as AuthenticatedRequest).user?.userId;
      if (!adminId) { res.status(403).json({ success: false, message: 'Admin required' }); return; }

      const session = await prisma.youTubeSession.findUnique({
        where: { admin_id: adminId },
        select: {
          google_email: true,
          google_password_enc: true,
          auto_login_enabled: true,
          auto_login_result: true,
          auto_login_at: true,
        },
      });

      res.status(200).json({
        success: true,
        data: {
          email: session?.google_email || null,
          hasPassword: !!session?.google_password_enc,
          enabled: session?.auto_login_enabled ?? false,
          lastResult: session?.auto_login_result || null,
          lastAttempt: session?.auto_login_at || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
