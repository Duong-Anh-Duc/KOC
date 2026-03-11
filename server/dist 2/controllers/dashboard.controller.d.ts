import { NextFunction, Request, Response } from 'express';
export declare class DashboardController {
    /**
     * GET /api/dashboard/overview
     */
    static getOverview(_req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/dashboard/revenue-trend
     */
    static getRevenueTrend(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=dashboard.controller.d.ts.map