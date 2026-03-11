import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare class AuthController {
    /**
     * POST /api/auth/login
     */
    static login(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/auth/register (Admin only)
     */
    static register(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/kocs/:id/account (Admin only) - Create a user account for a KOC
     */
    static createKocAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/auth/profile
     */
    static getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=auth.controller.d.ts.map