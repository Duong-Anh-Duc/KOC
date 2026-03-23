import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import { AuthService } from './auth.service';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days ms
  path: '/',
};

export class AuthController {
  /**
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const { accessToken, refreshToken, user } = await AuthService.login(email, password);

      res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('auth.loginSuccess') : 'Login successful',
        data: { token: accessToken, user },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Reads HttpOnly cookie, returns new access token + rotates refresh token
   */
  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (!token) {
        res.status(401).json({ success: false, message: 'No refresh token' });
        return;
      }

      const { accessToken, refreshToken, user } = await AuthService.refresh(token);
      res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

      res.status(200).json({
        success: true,
        data: { token: accessToken, user },
      });
    } catch (error) {
      // Clear invalid cookie
      res.clearCookie(REFRESH_COOKIE, { path: '/' });
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Revokes refresh token + clears cookie
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      await AuthService.logout(token);
      res.clearCookie(REFRESH_COOKIE, { path: '/' });
      res.status(200).json({ success: true });
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
   * PUT /api/auth/profile
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

      const { full_name, email } = req.body;
      const updated = await AuthService.updateProfile(req.user.userId, { full_name, email });

      res.status(200).json({
        success: true,
        message: t ? t('auth.profileUpdated') : 'Profile updated',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/change-password
   */
  static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, message: t ? t('auth.missingFields') : 'Missing fields' });
        return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({ success: false, message: t ? t('auth.passwordTooShort') : 'Password must be at least 6 characters' });
        return;
      }

      await AuthService.changePassword(req.user.userId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: t ? t('auth.passwordChanged') : 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/users (Admin only)
   */
  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const search = (req.query.search as string) || undefined;
      const result = await AuthService.listUsers(page, limit, search);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/auth/users/:id/active (Admin only)
   */
  static async toggleUserActive(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { is_active } = req.body;
      const user = await AuthService.toggleUserActive(id, is_active);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/auth/users/:id (Admin only)
   */
  static async adminUpdateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { full_name, email, role } = req.body;
      const user = await AuthService.adminUpdateUser(id, { full_name, email, role }, req.user!.userId);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/auth/users/:id (Admin only)
   */
  static async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await AuthService.deleteUser(id, req.user!.userId);
      res.status(200).json({ success: true });
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

  /**
   * POST /api/auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const t = (req as any).t;

      if (!email) {
        res.status(400).json({ success: false, message: t ? t('auth.emailRequired') : 'Email is required' });
        return;
      }

      await AuthService.requestPasswordReset(email);

      // Always return success to prevent email enumeration
      res.status(200).json({
        success: true,
        message: t ? t('auth.otpSent') : 'OTP has been sent to your email',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/verify-otp
   * Verify OTP without resetting password — unlocks the new-password step
   */
  static async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      const t = (req as any).t;

      if (!email || !otp) {
        res.status(400).json({ success: false, message: t ? t('auth.missingFields') : 'Missing required fields' });
        return;
      }

      await AuthService.verifyOTP(email, otp);

      res.status(200).json({
        success: true,
        message: t ? t('auth.otpVerified') : 'OTP verified',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/reset-password
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;
      const t = (req as any).t;

      if (!email || !otp || !newPassword) {
        res.status(400).json({ success: false, message: t ? t('auth.missingFields') : 'Missing required fields' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ success: false, message: t ? t('auth.passwordTooShort') : 'Password must be at least 6 characters' });
        return;
      }

      await AuthService.verifyOTPAndResetPassword(email, otp, newPassword);

      res.status(200).json({
        success: true,
        message: t ? t('auth.resetSuccess') : 'Password reset successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
