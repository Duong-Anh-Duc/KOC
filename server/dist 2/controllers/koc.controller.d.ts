import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class KOCController {
    /**
     * GET /api/kocs
     * Admin users only see their own KOCs
     */
    static getAll(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/kocs/active
     * Admin users only see their own active KOCs
     */
    static getActive(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/kocs/:id
     */
    static getById(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/kocs
     * Automatically assigns the KOC to the creating admin
     */
    static create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/kocs/:id
     */
    static update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * DELETE /api/kocs/:id
     */
    static delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/kocs/accounts-status
     * Returns a map of koc_id → boolean indicating if they have a user account
     * Admin only sees their own KOCs' account status
     */
    static getAccountsStatus(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=koc.controller.d.ts.map