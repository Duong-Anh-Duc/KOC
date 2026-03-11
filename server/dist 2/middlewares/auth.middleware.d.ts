import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../types';
/**
 * Middleware to verify JWT token and attach user to request
 */
export declare const authMiddleware: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
/**
 * Middleware to require ADMIN role
 */
export declare const adminOnly: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
/**
 * Middleware to block KOC role (allow ADMIN & ACCOUNTANT only)
 */
export declare const adminOrAccountant: (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.middleware.d.ts.map