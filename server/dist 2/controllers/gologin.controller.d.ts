import { Request, Response } from 'express';
export declare class GoLoginController {
    /**
     * POST /api/gologin/start
     * Body (optional): { profileId?: string }
     * Khởi động GoLogin profile và inject CHROME_CDP_URL để scraper dùng.
     */
    static start(_req: Request, res: Response): Promise<void>;
    /**
     * POST /api/gologin/stop
     * Body (optional): { stopLocal?: boolean }
     * Dừng GoLogin profile.
     */
    static stop(_req: Request, res: Response): Promise<void>;
    /**
     * GET /api/gologin/status
     * Trạng thái GoLogin profile hiện tại.
     */
    static getStatus(_req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=gologin.controller.d.ts.map