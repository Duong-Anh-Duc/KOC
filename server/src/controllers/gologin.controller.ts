import { Request, Response } from 'express';
import { GoLoginService } from '../services/gologin.service';

export class GoLoginController {
  /**
   * POST /api/gologin/start
   * Body (optional): { profileId?: string }
   * Khởi động GoLogin profile và inject CHROME_CDP_URL để scraper dùng.
   */
  static async start(_req: Request, res: Response): Promise<void> {
    try {
      const result = await GoLoginService.start();
      res.json({ success: true, message: 'GoLogin (Orbita) đã khởi động', ...result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/gologin/stop
   * Body (optional): { stopLocal?: boolean }
   * Dừng GoLogin profile.
   */
  static async stop(_req: Request, res: Response): Promise<void> {
    try {
      await GoLoginService.stop();
      res.json({ success: true, message: 'GoLogin (Orbita) đã dừng' });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/gologin/status
   * Trạng thái GoLogin profile hiện tại.
   */
  static async getStatus(_req: Request, res: Response): Promise<void> {
    const status = GoLoginService.getStatus();
    res.json({ success: true, ...status });
  }
}
