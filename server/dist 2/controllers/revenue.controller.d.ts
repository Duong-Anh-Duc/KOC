import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class RevenueController {
    /**
     * GET /api/revenue/records?cycle_id=X
     */
    static getRecordsByCycle(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/revenue/records/:id
     */
    static getRecordById(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/revenue/records
     */
    static createRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/revenue/records/:id
     */
    static updateRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/revenue/records/bulk
     */
    static bulkCreateRecords(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/revenue/records/:id
     */
    static deleteRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/revenue/records/bulk
     * Body: { ids: string[] }
     */
    static bulkDeleteRecords(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PATCH /api/revenue/records/:id/approve
     */
    static approveRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/revenue/calculate (preview calculation without saving)
     */
    static previewCalculation(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/revenue/payment-status?cycle_id=X
     * Returns accumulated balance / $100 threshold status for each KOC
     */
    static getPaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=revenue.controller.d.ts.map