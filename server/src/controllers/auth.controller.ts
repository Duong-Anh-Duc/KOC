import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services';
import { AuthenticatedRequest } from '../types';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('auth.loginSuccess') : 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/register (Admin only)
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, full_name, role } = req.body;
      const user = await AuthService.register(email, password, full_name, role);

      const t = (req as any).t;
      res.status(201).json({
        success: true,
        message: t ? t('auth.registerSuccess') : 'User registered successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/kocs/:id/account (Admin only) - Create a user account for a KOC
   */
  static async createKocAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { email, password } = req.body;
      const user = await AuthService.createKocAccount(id, email, password);

      const t = (req as any).t;
      res.status(201).json({
        success: true,
        message: t ? t('auth.kocAccountCreated') : 'KOC account created successfully',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/profile
   */
  static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      if (!req.user) {
        res.status(401).json({ success: false, message: t ? t('auth.unauthorized') : 'Unauthorized' });
        return;
      }

      const user = await AuthService.getProfile(req.user.userId);

      res.status(200).json({
        success: true,
        message: t ? t('auth.profileRetrieved') : 'Profile retrieved',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}
