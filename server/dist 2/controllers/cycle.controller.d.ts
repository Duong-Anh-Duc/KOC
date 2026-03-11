import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class CycleController {
    /**
     * GET /api/cycles
     */
    static getAll(_req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/cycles/:id
     */
    static getById(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/cycles
     */
    static create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/cycles/:id/add-kocs
     * Body: { kocIds?: string[] }  — omit to add ALL missing active KOCs
     */
    static addKocs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/cycles/:id
     */
    static update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /api/cycles/:id/lock
     */
    static lock(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /api/cycles/:id/reopen
     */
    static reopen(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /api/cycles/:id/complete
     */
    static complete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/cycles/:id
     */
    static delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/cycles/exchange-rate
     * Fetch current USD/VND exchange rate from webgia.com
     */
    static getExchangeRate(_req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/cycles/:id/scrape-revenue
     * Scrape YouTube revenue for all active KOCs for the cycle's month,
     * then auto-create revenue records from the scraped data
     */
    static scrapeRevenue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/cycles/:id/check-pub-codes
     * Check pub codes for all KOCs in a cycle, update revenue records
     */
    static checkPubCodes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    private static runCheckPubCodes;
    /**
     * Background method to run scrape revenue with progress
     */
    private static runScrapeRevenue;
}
//# sourceMappingURL=cycle.controller.d.ts.map