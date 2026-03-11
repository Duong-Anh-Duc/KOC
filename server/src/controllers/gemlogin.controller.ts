import { Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../middlewares/logger.middleware';
import { AuthenticatedRequest } from '../types';
import { GemLoginService } from '../services/gemlogin.service';
import { ProgressService } from '../services/progress.service';

export class GemLoginController {
  // ── Info ──────────────────────────────────────────────────────────────────

  static async getBrowserVersions(_req: Request, res: Response): Promise<void> {
    try {
      const data = await GemLoginService.getBrowserVersions();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getGroups(_req: Request, res: Response): Promise<void> {
    try {
      const data = await GemLoginService.getGroups();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  // ── Profiles ──────────────────────────────────────────────────────────────

  static async getProfiles(_req: Request, res: Response): Promise<void> {
    try {
      const data = await GemLoginService.getProfiles();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const data = await GemLoginService.getProfile(String(req.params.id));
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async createProfile(req: Request, res: Response): Promise<void> {
    try {
      const data = await GemLoginService.createProfile(req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const data = await GemLoginService.updateProfile(String(req.params.id), req.body);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async deleteProfile(req: Request, res: Response): Promise<void> {
    try {
      const data = await GemLoginService.deleteProfile(String(req.params.id));
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  static async changeFingerprint(req: Request, res: Response): Promise<void> {
    try {
      const ids = req.query.ids ? String(req.query.ids).split(',') : undefined;
      const data = await GemLoginService.changeFingerprint(ids);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  // ── Start / Close (tích hợp với YouTubeScraperService) ───────────────────

  /**
   * POST /api/gemlogin/start
   * Body: { profileId: string }
   * Khởi động browser và inject CHROME_CDP_URL để scraper dùng.
   */
  static async startProfile(req: Request, res: Response): Promise<void> {
    try {
      const profileId: string = req.body?.profileId || process.env.GEMLOGIN_PROFILE_ID || '1';
      const result = await GemLoginService.startProfile(profileId);
      res.json({ success: true, message: 'GemLogin profile đã khởi động', ...result });
    } catch (err: any) {
      logger.error(`[GemLogin] startProfile error: ${err.message}`);
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/gemlogin/close
   * Body (optional): { profileId?: string }
   */
  static async closeProfile(req: Request, res: Response): Promise<void> {
    try {
      const profileId: string | undefined = req.body?.profileId;
      await GemLoginService.closeProfile(profileId);
      res.json({ success: true, message: 'GemLogin profile đã đóng' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/gemlogin/status
   */
  static async getStatus(_req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-store');
    const status = GemLoginService.getStatus();
    res.json({ success: true, ...status });
  }

  // ── Scrape doanh thu qua GemLogin ────────────────────────────────────────

  /**
   * POST /api/gemlogin/scrape-revenue
   * Cào song song: mở 5 tab cùng lúc, đợi 2.5 phút, extract đồng loạt.
   * Body (optional): { profileId?, month?, closeAfter?, batchSize?, waitSeconds? }
   */
  static async scrapeRevenue(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user?.userId;
    const profileId: string = req.body?.profileId || process.env.GEMLOGIN_PROFILE_ID || '1';
    const month: string | undefined = req.body?.month;
    const closeAfter: boolean = req.body?.closeAfter === true;
    const batchSize: number = req.body?.batchSize || 5;
    const waitSeconds: number = req.body?.waitSeconds || 1800;
    const kocIds: string[] | undefined = Array.isArray(req.body?.kocIds) && req.body.kocIds.length > 0 ? req.body.kocIds : undefined;
    const saveToDb: boolean = req.body?.saveToDb !== false;

    // Trả taskId ngay — client dùng SSE để theo dõi tiến trình
    const taskId = ProgressService.generateTaskId('scrape');
    res.json({ success: true, data: { taskId } });

    // Chạy ngầm
    (async () => {
      let startedHere = false;
      try {
        if (!GemLoginService.getStatus().isRunning) {
          ProgressService.emit(taskId, { step: 0, total: 1, percent: 0, message: 'Đang khởi động GemLogin...' });
          await GemLoginService.startProfile(profileId);
          startedHere = true;
        }

        const kocWhere = {
          status: 'ACTIVE' as const,
          ...(adminId ? { admin_id: adminId } : {}),
          ...(kocIds ? { id: { in: kocIds } } : {}),
        };

        const kocs = await prisma.kOC.findMany({
          where: kocWhere,
          select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true },
        });

        if (kocs.length === 0) {
          ProgressService.complete(taskId, { total: 0, success: 0, failed: 0, results: [], errors: [] });
          return;
        }

        ProgressService.emit(taskId, { step: 0, total: kocs.length, percent: 0, message: `Bắt đầu cào ${kocs.length} KOC...` });

        const { YouTubeScraperService } = await import('../services/youtube-scraper.service');
        const { YouTubeScrapeResultService } = await import('../services/youtube-scrape-result.service');

        const channelIds = kocs
          .map(k => YouTubeScraperService.cleanChannelId(k.youtube_channel_id))
          .filter(id => id && id.length > 0);

        let doneCount = 0;
        const { results, errors } = await YouTubeScraperService.scrapeMultipleChannelsParallel(
          channelIds,
          month,
          (channelId, _index, total) => {
            doneCount++;
            const koc = kocs.find(k => YouTubeScraperService.cleanChannelId(k.youtube_channel_id) === channelId);
            const name = koc?.full_name || koc?.channel_name || channelId;
            ProgressService.emit(taskId, {
              step: doneCount,
              total,
              percent: Math.round((doneCount / total) * 100),
              message: `Đã cào: ${name}`,
            });
          },
          adminId,
          channelIds.length,
          waitSeconds * 1000,
        );

        const batchItems = results
          .map(r => {
            const koc = kocs.find(k => YouTubeScraperService.cleanChannelId(k.youtube_channel_id) === r.channelId);
            return koc ? { kocId: koc.id, channelId: koc.youtube_channel_id, analytics: r } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        if (saveToDb && batchItems.length > 0) {
          ProgressService.emit(taskId, { step: kocs.length, total: kocs.length, percent: 99, message: 'Đang lưu dữ liệu...' });
          await YouTubeScrapeResultService.saveBatchResults(batchItems);
        }

        const finalData = {
          total: kocs.length,
          success: results.length,
          failed: errors.length,
          savedToDb: saveToDb && batchItems.length > 0,
          results: results.map(r => {
            const koc = kocs.find(k => YouTubeScraperService.cleanChannelId(k.youtube_channel_id) === r.channelId);
            return {
              kocId: koc?.id,
              fullName: koc?.full_name,
              channelName: koc?.channel_name,
              channelId: r.channelId,
              estimatedRevenue: r.totals.estimatedRevenue,
              views: r.totals.views,
              watchTimeHours: r.totals.watchTimeHours,
              period: r.period,
              countries: r.countries,
            };
          }),
          errors,
        };

        ProgressService.complete(taskId, finalData);
        logger.info(`[GemLogin] scrapeRevenue done: ${results.length}/${kocs.length} KOC`);
      } catch (err: any) {
        logger.error(`[GemLogin] scrapeRevenue error: ${err.message}`);
        ProgressService.error(taskId, err.message);
      } finally {
        if (closeAfter && startedHere) {
          await GemLoginService.closeProfile(profileId).catch(() => {});
        }
      }
    })();
  }

  /**
   * POST /api/gemlogin/run-cron
   * Chạy toàn bộ quy trình tự động: tạo cycle → cào doanh thu → lưu records.
   * Tương đương trigger cron job nhưng qua GemLogin (không cần session YouTube).
   * Body (optional): { profileId?, closeAfter? }
   */
  static async runCron(req: Request, res: Response): Promise<void> {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user?.userId;
    const profileId: string = req.body?.profileId || process.env.GEMLOGIN_PROFILE_ID || '1';
    const closeAfter: boolean = req.body?.closeAfter === true;

    let startedHere = false;
    try {
      // Bật profile trước khi chạy cron (inject CHROME_CDP_URL để cron tự dùng)
      if (!GemLoginService.getStatus().isRunning) {
        await GemLoginService.startProfile(profileId);
        startedHere = true;
      }

      const { CronService } = await import('../services/cron.service');
      const result = await CronService.runJob(adminId);

      res.json({ success: result.success, message: result.message, data: { cycleMonth: result.cycleMonth } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    } finally {
      if (closeAfter && startedHere) {
        await GemLoginService.closeProfile(profileId).catch(() => {});
      }
    }
  }
}
