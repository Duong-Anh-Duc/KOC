import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class KocPortalController {
    /**
     * GET /api/koc-portal/my-revenue
     * Returns all revenue records for the logged-in KOC user, grouped by cycle
     */
    static getMyRevenue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/koc-portal/my-stats
     * Returns latest channel stats for the logged-in KOC
     */
    static getMyStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=koc-portal.controller.d.ts.map