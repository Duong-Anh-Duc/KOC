import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthenticatedRequest } from '../../types';
import logger from '../../middlewares/logger.middleware';
import { SettingsService } from './settings.service';
import { GoogleAutoLoginService } from '../shared/google-login.service';
import { GemLoginService } from '../gemlogin/gemlogin.service';
import { ProgressService } from '../shared/progress.service';
import { chromium, type Page } from 'playwright';

/** Ghi 1 dòng debug + screenshot vào logs/test-login/<timestamp>/ để diagnose. */
async function dlog(dir: string, label: string, page?: Page, extra?: string): Promise<void> {
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString();
  const url = page ? page.url() : '';
  const text = page
    ? await page.evaluate(() => document.body?.innerText?.substring(0, 400) || '').catch(() => '')
    : '';
  const line = `[${ts}] ${label}\n  URL: ${url}\n  TEXT: ${text.replace(/\n+/g, ' | ').substring(0, 300)}\n  ${extra || ''}\n\n`;
  fs.appendFileSync(path.join(dir, 'trace.log'), line);
  if (page) {
    const safe = label.replace(/[^a-z0-9-]/gi, '_').toLowerCase().substring(0, 40);
    await page.screenshot({ path: path.join(dir, `${safe}.png`), fullPage: true }).catch(() => {});
  }
}

/**
 * Cache trạng thái Google login (60s) — tránh check liên tục mỗi lần FE poll.
 */
let googleStatusCache: {
  loggedIn: boolean;
  checkedAt: number;
  email: string | null;
  message: string | null;
} | null = null;
const STATUS_CACHE_MS = 60_000;

/** Dedupe — call check thứ 2 trong khi call 1 đang chạy sẽ nhận cùng taskId, subscribe cùng SSE. */
let activeCheckTaskId: string | null = null;

export class SettingsController {
  /** GET /api/settings/google-login — trạng thái credentials (không trả password thô) */
  static async getGoogleLogin(_req: Request, res: Response): Promise<void> {
    try {
      const status = await SettingsService.getGoogleLoginStatus();
      res.json({ success: true, data: status });
    } catch (err: any) {
      logger.error(`[Settings] getGoogleLogin: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /** PUT /api/settings/google-login — cập nhật credentials (chỉ field truyền) */
  static async updateGoogleLogin(req: Request, res: Response): Promise<void> {
    try {
      const adminId = (req as AuthenticatedRequest).user?.userId || null;
      const { email, password, totpSecret, autoLoginEnabled } = req.body || {};

      // Validate
      if (email !== undefined && email !== null && typeof email !== 'string') {
        res.status(400).json({ success: false, message: 'email phải là string' });
        return;
      }
      if (password !== undefined && password !== null && typeof password !== 'string') {
        res.status(400).json({ success: false, message: 'password phải là string' });
        return;
      }
      if (totpSecret !== undefined && totpSecret !== null && typeof totpSecret !== 'string') {
        res.status(400).json({ success: false, message: 'totpSecret phải là string' });
        return;
      }

      const status = await SettingsService.updateGoogleLogin(adminId, {
        email,
        password,
        totpSecret,
        autoLoginEnabled,
      });

      // Invalidate cache
      googleStatusCache = null;

      res.json({ success: true, data: status, message: 'Đã cập nhật credentials' });
    } catch (err: any) {
      logger.error(`[Settings] updateGoogleLogin: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/settings/google-login/test — trigger auto-login ngay để verify.
   *
   * Body: { incognito?: boolean }
   *   incognito=true (mặc định): tạo context mới qua CDP Target.createBrowserContext
   *     → không share cookies với session hiện tại → bắt buộc Google show full login flow.
   *   incognito=false: dùng context default (có cookies) → nếu đang login sẵn sẽ skip,
   *     nhưng test không exercise được full flow.
   */
  static async testGoogleLogin(req: Request, res: Response): Promise<void> {
    const incognito = req.body?.incognito !== false; // default true
    let cleanupCtx: { browserContextId?: string; cdp?: any } = {};
    try {
      // Đảm bảo GemLogin đang chạy
      if (!GemLoginService.getStatus().isRunning) {
        const profileId = process.env.GEMLOGIN_PROFILE_ID || '1';
        await GemLoginService.startProfile(profileId);
      }

      const cdpUrl = process.env.CHROME_CDP_URL;
      if (!cdpUrl) {
        res.status(500).json({ success: false, message: 'CDP URL không có sau khi start GemLogin' });
        return;
      }

      const browser = await chromium.connectOverCDP(cdpUrl);
      const defaultContext = browser.contexts()[0];
      if (!defaultContext) {
        res.status(500).json({ success: false, message: 'Không có context trong GemLogin browser' });
        return;
      }

      // Tạo context ẩn danh nếu yêu cầu (cookie isolated)
      let testContext = defaultContext;
      let createdIncognitoContext: any = null;
      if (incognito) {
        try {
          createdIncognitoContext = await browser.newContext();
          testContext = createdIncognitoContext;
          logger.info('[Settings] Test login dùng newContext() (cookie isolated)');
        } catch (err: any) {
          logger.warn(`[Settings] newContext() fail (${err.message}) — clear cookies trên default context`);
          await defaultContext.clearCookies({ domain: '.google.com' as any } as any).catch(() => {});
          await defaultContext.clearCookies({ domain: '.youtube.com' as any } as any).catch(() => {});
        }
      }

      const debugDir = path.join(process.cwd(), 'logs', 'test-login', new Date().toISOString().replace(/[:.]/g, '-'));
      const page = await testContext.newPage();
      await page.bringToFront().catch(() => {});
      try {
        await dlog(debugDir, `00-start (incognito=${incognito})`, undefined, `Profile=${process.env.GEMLOGIN_PROFILE_ID || '1'}`);
        logger.info(`[Settings] Test: navigate studio.youtube.com (incognito=${incognito})`);
        await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
        await page.waitForTimeout(2_000);
        await dlog(debugDir, '01-after-goto-studio', page);

        const beforeUrl = page.url();
        if (!beforeUrl.includes('accounts.google.com')) {
          googleStatusCache = { loggedIn: true, checkedAt: Date.now(), email: null, message: 'Đã login sẵn' };
          res.json({
            success: true,
            loggedIn: true,
            incognito,
            message: incognito ? 'Đã login OK trong incognito (nhưng không exercise full flow)' : 'Tài khoản còn session, không cần login',
            debugDir,
          });
          return;
        }

        const ok = await GoogleAutoLoginService.ensureLoggedIn(page, 'https://studio.youtube.com/');
        await dlog(debugDir, `02-after-ensureLoggedIn (returned=${ok})`, page);

        const finalUrl = page.url();
        const loggedIn = ok && !finalUrl.includes('accounts.google.com');

        googleStatusCache = {
          loggedIn,
          checkedAt: Date.now(),
          email: null,
          message: loggedIn ? 'Login OK' : `Login fail (URL: ${finalUrl})`,
        };

        res.json({
          success: ok,
          loggedIn,
          incognito,
          message: loggedIn ? `Auto-login thành công${incognito ? ' (incognito)' : ''}` : 'Auto-login fail — xem log server',
          finalUrl,
          debugDir,
        });
      } finally {
        await page.close().catch(() => {});
        // Dispose incognito context (Playwright hoặc CDP) để cleanup
        if (createdIncognitoContext) {
          await createdIncognitoContext.close().catch(() => {});
        }
        if (cleanupCtx.browserContextId && cleanupCtx.cdp) {
          await cleanupCtx.cdp
            .send('Target.disposeBrowserContext' as any, { browserContextId: cleanupCtx.browserContextId } as any)
            .catch(() => {});
        }
      }
    } catch (err: any) {
      logger.error(`[Settings] testGoogleLogin: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/gemlogin/google-status — đọc trạng thái từ DB (KHÔNG mở browser).
   * FE có thể poll nhẹ. Status được update khi: auto-login attempt hoặc manual /check.
   */
  static async getGoogleStatus(_req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-store');
    try {
      const status = await SettingsService.getSessionStatus();
      res.json({
        success: true,
        loggedIn: status.isLoggedIn,
        verifiedAt: status.verifiedAt ? status.verifiedAt.toISOString() : null,
        disconnectedAt: status.disconnectedAt ? status.disconnectedAt.toISOString() : null,
        disconnectReason: status.disconnectReason,
        message: status.isLoggedIn
          ? `Đã login (verify ${status.verifiedAt ? status.verifiedAt.toLocaleString() : '?'})`
          : `Chưa login${status.disconnectReason ? ` — ${status.disconnectReason}` : ''}`,
      });
    } catch (err: any) {
      logger.error(`[Settings] getGoogleStatus: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/gemlogin/google-status/check — kiểm tra session + auto-login nếu cần.
   *
   * Trả về `taskId` ngay lập tức để FE subscribe SSE qua /api/progress/:taskId
   * (xem step text như "Đang nhập mật khẩu...", "Đang lấy TOTP...").
   *
   * Background:
   *   1. Mở page → studio.youtube.com
   *   2. Nếu KHÔNG redirect login → mark is_logged_in=true, complete
   *   3. Nếu redirect → call ensureLoggedIn(taskId) emit step events
   *   4. Update DB, complete với result
   */
  static async checkGoogleStatus(_req: Request, res: Response): Promise<void> {
    // Dedupe: nếu đang có check chạy → trả luôn taskId đó để FE subscribe cùng stream.
    // Tránh race: 2 call song song → call sau đè status của call trước = false.
    if (activeCheckTaskId) {
      res.json({ success: true, taskId: activeCheckTaskId, deduped: true });
      return;
    }

    const taskId = `google-login-${Date.now()}`;
    activeCheckTaskId = taskId;
    res.json({ success: true, taskId });

    // Background work — không await để FE thấy taskId ngay
    void (async () => {
      try {
        if (!GemLoginService.getStatus().isRunning) {
          ProgressService.emit(taskId, { step: 0, total: 1, percent: 0, message: 'Đang khởi động GemLogin...' });
          await GemLoginService.startProfile(process.env.GEMLOGIN_PROFILE_ID || '1').catch(() => {});
        }

        const cdpUrl = process.env.CHROME_CDP_URL;
        if (!cdpUrl) {
          ProgressService.error(taskId, 'CDP URL chưa sẵn sàng');
          return;
        }

        ProgressService.emit(taskId, { step: 0, total: 1, percent: 5, message: 'Kết nối GemLogin browser...' });
        const browser = await chromium.connectOverCDP(cdpUrl);
        const context = browser.contexts()[0];
        if (!context) {
          ProgressService.error(taskId, 'Không có context');
          return;
        }

        const page = await context.newPage();
        try {
          await page.route('**/*', (route) => {
            const t = route.request().resourceType();
            if (['image', 'font', 'media', 'stylesheet'].includes(t)) return route.abort();
            return route.continue();
          });

          ProgressService.emit(taskId, { step: 0, total: 1, percent: 10, message: 'Mở studio.youtube.com để check session...' });
          await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
          await page.waitForTimeout(1_500);

          const url = page.url();
          const stillLoggedIn = !url.includes('accounts.google.com') && !url.includes('about:blank');

          if (stillLoggedIn) {
            await SettingsService.markSessionStatus(true);
            googleStatusCache = null;
            ProgressService.complete(taskId, { loggedIn: true, message: 'Session vẫn OK, không cần login' });
            return;
          }

          // Bị logout → trigger auto-login với progress
          ProgressService.emit(taskId, { step: 1, total: 8, percent: 12, message: 'Phát hiện bị logout — bắt đầu auto-login...' });
          const ok = await GoogleAutoLoginService.ensureLoggedIn(page, 'https://studio.youtube.com/', taskId);
          await SettingsService.markSessionStatus(ok, ok ? undefined : 'auto_login_failed');
          googleStatusCache = null;
          ProgressService.complete(taskId, {
            loggedIn: ok,
            message: ok ? 'Auto-login thành công' : 'Auto-login fail — xem log',
            finalUrl: page.url(),
          });
        } finally {
          await page.close().catch(() => {});
        }
      } catch (err: any) {
        logger.error(`[Settings] checkGoogleStatus background error: ${err.message}`);
        ProgressService.error(taskId, `Lỗi: ${err.message}`);
      } finally {
        if (activeCheckTaskId === taskId) activeCheckTaskId = null;
      }
    })();
  }

  /** Reset cache (legacy — vẫn giữ để tránh break import). */
  static invalidateGoogleStatusCache(): void {
    googleStatusCache = null;
  }
}
