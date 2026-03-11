import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class CronController {
    /**
     * GET /api/cron/config
     * Get current cron configuration
     */
    static getConfig(_req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/cron/config
     * Update cron configuration
     */
    static updateConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/cron/run
     * Manually trigger the cron job
     */
    static runNow(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/cron/history
     * Get cron run history
     */
    static getHistory(_req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/cron/next-month
     * Preview what the next auto-cycle would create
     */
    static previewNextRun(_req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=cron.controller.d.ts.map