import { NextFunction, Request, Response } from 'express';
export declare class StatsController {
    /**
     * GET /api/stats/:kocId
     */
    static getHistory(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/stats/:kocId/fetch
     */
    static fetchStats(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/stats/fetch-all
     * Returns immediately with taskId; runs fetch in background with SSE progress.
     */
    static fetchAllStats(_req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/stats/latest
     */
    static getLatest(_req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/stats/:kocId/growth
     * Returns detailed YT Studio analytics for a single KOC
     */
    static getGrowth(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/stats/growth/all
     * Returns YT Studio analytics for all KOCs
     */
    static getAllGrowth(_req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/stats/:kocId/correlation?months=6
     */
    static getCorrelation(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=stats.controller.d.ts.map