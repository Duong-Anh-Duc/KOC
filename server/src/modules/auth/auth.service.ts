import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import prisma from '../../config/database';
import { OtpStore, RefreshTokenStore } from '../../config/redis';
import { ApiError } from '../../middlewares';
import logger from '../../middlewares/logger.middleware';
import { JwtPayload } from '../../types';
import { EmailService } from '../email/email.service';

export class AuthService {
  /**
   * Login with email and password
   */
  static async login(email: string, password: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<JwtPayload, 'iat' | 'exp'> & { full_name: string; avatar_url: string | null };
  }> {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.is_active) {
      throw new ApiError(401, 'auth.loginFailed');
    }

    if (user.is_ban) {
      throw new ApiError(403, 'auth.accountSuspended');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new ApiError(401, 'auth.loginFailed');
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(user.koc_id ? { kocId: user.koc_id } : {}),
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessTokenExpiresIn,
    } as jwt.SignOptions);

    const refreshToken = crypto.randomBytes(40).toString('hex');
    await RefreshTokenStore.set(refreshToken, user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        ...(user.koc_id ? { kocId: user.koc_id } : {}),
      },
    };
  }

  /**
   * Refresh access token using refresh token (with rotation)
   */
  static async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Omit<JwtPayload, 'iat' | 'exp'> & { full_name: string; avatar_url: string | null };
  }> {
    const userId = await RefreshTokenStore.get(refreshToken);
    if (!userId) throw new ApiError(401, 'auth.tokenExpired');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.is_active) throw new ApiError(401, 'auth.unauthorized');
    if (user.is_ban) throw new ApiError(403, 'auth.accountSuspended');

    // Rotate: delete old, issue new
    await RefreshTokenStore.del(refreshToken);

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(user.koc_id ? { kocId: user.koc_id } : {}),
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.accessTokenExpiresIn,
    } as jwt.SignOptions);

    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    await RefreshTokenStore.set(newRefreshToken, user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        userId: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        ...(user.koc_id ? { kocId: user.koc_id } : {}),
      },
    };
  }

  /**
   * Logout — revoke the refresh token
   */
  static async logout(refreshToken: string): Promise<void> {
    if (refreshToken) await RefreshTokenStore.del(refreshToken);
  }

  /**
   * Register a new user (Admin only operation)
   */
  static async register(
    email: string,
    password: string,
    fullName: string,
    role: UserRole = UserRole.ACCOUNTANT
  ) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(409, 'auth.emailExists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        full_name: fullName,
        role,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        created_at: true,
      },
    });

    return user;
  }

  /**
   * Create a user account for a KOC (Admin only)
   */
  static async createKocAccount(kocId: string, email: string, password: string) {
    // Verify KOC exists
    const koc = await prisma.kOC.findUnique({ where: { id: kocId } });
    if (!koc) {
      throw new ApiError(404, 'koc.notFound');
    }

    // Check if KOC already has an account
    const existingLink = await prisma.user.findFirst({ where: { koc_id: kocId } });
    if (existingLink) {
      throw new ApiError(409, 'auth.kocAccountExists');
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(409, 'auth.emailExists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        full_name: koc.full_name,
        role: UserRole.KOC,
        koc_id: kocId,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        koc_id: true,
        created_at: true,
      },
    });

    return user;
  }

  /**
   * Update user profile (full_name, email)
   */
  static async updateProfile(userId: string, data: { full_name?: string; email?: string }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'auth.userNotFound');

    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new ApiError(409, 'auth.emailExists');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
      },
      select: { id: true, email: true, full_name: true, role: true, is_active: true, is_ban: true, koc_id: true, avatar_url: true, created_at: true },
    });

    return updated;
  }

  /**
   * Change password (requires current password)
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'auth.userNotFound');

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) throw new ApiError(400, 'auth.wrongCurrentPassword');

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHash },
    });
  }

  /**
   * Get current user info
   */
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        is_active: true,
        is_ban: true,
        koc_id: true,
        avatar_url: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'auth.userNotFound');
    }

    return user;
  }

  /**
   * Request password reset - generates OTP, stores in Redis (5 min TTL) and sends via email
   */
  static async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(404, 'auth.emailNotFound');
    if (user.is_ban) throw new ApiError(403, 'auth.accountSuspended');

    // Generate 6-digit OTP and store in Redis (overwrites any existing)
    const otp = crypto.randomInt(100000, 999999).toString();
    await OtpStore.set(email, otp);

    // Send email with OTP
    try {
      const emailConfig = await EmailService.getConfig();
      const transporter = await EmailService.createTransporter();

      await transporter.sendMail({
        from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
        to: email,
        subject: 'Mã xác nhận đặt lại mật khẩu - EBE CMS',
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: auto; padding: 32px;">
            <h2 style="color: #ED8F3A; text-align: center;">Đặt lại mật khẩu</h2>
            <p>Xin chào <strong>${user.full_name}</strong>,</p>
            <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản EBE CMS. Vui lòng sử dụng mã OTP bên dưới:</p>
            <div style="text-align: center; margin: 28px 0;">
              <div style="display: inline-block; padding: 16px 32px; background: #f5f5f5; border-radius: 8px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #ED8F3A;">
                ${otp}
              </div>
            </div>
            <p style="color: #ff4d4f; font-weight: 600;">Mã này sẽ hết hạn sau 5 phút.</p>
            <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #888; font-size: 12px; text-align: center;">EBE CMS — Thông báo tự động</p>
          </div>
        `,
      });

      logger.info(`[AuthService] Password reset OTP sent to ${email}`);
    } catch (err: any) {
      logger.error(`[AuthService] Failed to send OTP email to ${email}: ${err.message}`);
      throw new ApiError(500, 'auth.otpSendFailed');
    }
  }

  /**
   * List manageable users (ACCOUNTANT + VIEWER only, no ADMIN/KOC)
   */
  static async listUsers(page: number = 1, limit: number = 20, search?: string) {
    const where = {
      role: { in: [UserRole.ACCOUNTANT, UserRole.VIEWER] as UserRole[] },
      ...(search ? {
        OR: [
          { full_name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };
    const baseWhere = { role: { in: [UserRole.ACCOUNTANT, UserRole.VIEWER] as UserRole[] } };
    const [data, total, activeCount, accountantCount, viewerCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, full_name: true, role: true, is_active: true, is_ban: true, created_at: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { ...baseWhere, is_active: true } }),
      prisma.user.count({ where: { ...baseWhere, role: UserRole.ACCOUNTANT } }),
      prisma.user.count({ where: { ...baseWhere, role: UserRole.VIEWER } }),
    ]);
    return { data, total, page, limit, stats: { activeCount, accountantCount, viewerCount } };
  }

  /**
   * Toggle user active status
   */
  static async toggleUserActive(userId: string, is_active: boolean) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'auth.userNotFound');
    if (user.role === UserRole.ADMIN) throw new ApiError(400, 'auth.cannotDeactivateAdmin');

    return prisma.user.update({
      where: { id: userId },
      data: { is_active },
      select: { id: true, email: true, full_name: true, role: true, is_active: true, is_ban: true },
    });
  }

  /**
   * Update user (admin) — name, email, role
   */
  static async adminUpdateUser(userId: string, data: { full_name?: string; email?: string; role?: UserRole }, requestingUserId: string) {
    if (userId === requestingUserId) throw new ApiError(400, 'auth.cannotEditSelf');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'auth.userNotFound');
    if (user.role === UserRole.ADMIN) throw new ApiError(400, 'auth.cannotEditAdmin');

    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new ApiError(409, 'auth.emailExists');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { ...data },
      select: { id: true, email: true, full_name: true, role: true, is_active: true, is_ban: true },
    });
  }

  /**
   * Delete user (admin)
   */
  static async deleteUser(userId: string, requestingUserId: string) {
    if (userId === requestingUserId) throw new ApiError(400, 'auth.cannotDeleteSelf');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, 'auth.userNotFound');
    if (user.role === UserRole.ADMIN) throw new ApiError(400, 'auth.cannotDeleteAdmin');
    await prisma.user.delete({ where: { id: userId } });
  }

  /**
   * Verify OTP only (does NOT consume it) — used to unlock the new-password step
   */
  static async verifyOTP(email: string, otp: string): Promise<void> {
    const stored = await OtpStore.get(email);
    if (!stored) throw new ApiError(400, 'auth.otpExpired');
    if (stored !== otp) throw new ApiError(400, 'auth.otpInvalid');
  }

  /**
   * Verify OTP + reset password (consumes OTP)
   */
  static async verifyOTPAndResetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const stored = await OtpStore.get(email);
    if (!stored) throw new ApiError(400, 'auth.otpExpired');
    if (stored !== otp) throw new ApiError(400, 'auth.otpInvalid');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(404, 'auth.userNotFound');
    if (user.is_ban) throw new ApiError(403, 'auth.accountSuspended');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: passwordHash },
    });

    // Consume OTP after successful reset
    await OtpStore.del(email);

    logger.info(`[AuthService] Password reset successful for ${email}`);
  }
}
