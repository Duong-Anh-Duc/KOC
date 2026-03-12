import { NextFunction, Request, Response } from 'express';
import prisma from '../config/database';
import { YouTubeScraperService } from '../services/youtube-scraper.service';
import { AuthenticatedRequest } from '../types';

export class ScraperLoginController {
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
          message: t ? t('ytScraper.autoConnectSuccess') : 'Kết nối ẩn thành công - Sẵn sàng cào dữ liệu',
          data: { loggedIn: true, sessionValid: true },
        });
      } else {
        res.status(200).json({
          success: false,
          message: t ? t('ytScraper.autoConnectFailed') : 'Chưa có session. Vui lòng mở trình duyệt để đăng nhập Google.',
          data: { loggedIn: false, sessionValid: false },
        });
      }
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
