import { NextFunction, Request, Response } from 'express';
export declare class AuditController {
    /**
     * GET /api/audit-logs
     * Admin only sees logs from their own actions
     */
    static getLogs(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=audit.controller.d.ts.map