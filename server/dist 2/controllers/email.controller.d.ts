import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class EmailController {
    /**
     * GET /api/email/config
     * Get email configuration
     */
    static getConfig(_req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * PUT /api/email/config
     * Update email configuration
     */
    static updateConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/email/test
     * Send a test email
     */
    static sendTestEmail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/email/send-revenue
     * Send revenue emails to all KOCs for a specific month
     */
    static sendRevenueEmails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Background method to send revenue emails with progress
     */
    private static runSendRevenueEmails;
    /**
     * GET /api/email/cycles
     * Get list of available cycles for sending emails
     */
    static getAvailableCycles(_req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=email.controller.d.ts.map