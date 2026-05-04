import prisma from '../../config/database';
import logger from '../../middlewares/logger.middleware';
import { encryptString, tryDecryptString } from '../../utils/crypto';

/**
 * SettingsService — quản lý credentials Google auto-login lưu DB (mã hoá AES-256-GCM).
 *
 * Lưu trong bảng `youtube_sessions`:
 *   - google_email
 *   - google_password_enc       (encrypted)
 *   - google_totp_secret_enc    (encrypted)
 *   - auto_login_enabled
 *
 * Hiện tại: dùng SYSTEM-WIDE — chọn YouTubeSession đầu tiên có auto_login_enabled=true,
 * fallback về YouTubeSession của bất kỳ admin nào, fallback cuối về env.
 *
 * Tương lai có thể chia per-admin nếu cần.
 */

export interface GoogleLoginCredentials {
  email: string | null;
  password: string | null;
  totpSecret: string | null;
}

export interface GoogleLoginCredentialsStatus {
  email: string | null;
  hasPassword: boolean;
  hasTotpSecret: boolean;
  /** Password đã giải mã — chỉ trả cho admin authenticated. Null nếu chưa set hoặc decrypt fail. */
  password: string | null;
  /** TOTP secret đã giải mã — null nếu chưa set hoặc decrypt fail. */
  totpSecret: string | null;
  autoLoginEnabled: boolean;
  lastResult: string | null;
  lastAttemptAt: Date | null;
}

export interface UpdateGoogleLoginInput {
  email?: string | null;
  password?: string | null;
  totpSecret?: string | null;
  autoLoginEnabled?: boolean;
}

export class SettingsService {
  /**
   * Lấy credentials thực (đã giải mã) cho GoogleAutoLoginService dùng.
   * Ưu tiên: session với auto_login_enabled=true → bất kỳ session nào → env fallback.
   */
  static async getGoogleLoginCredentials(): Promise<GoogleLoginCredentials> {
    const session =
      (await prisma.youTubeSession.findFirst({
        where: { auto_login_enabled: true },
        orderBy: { updated_at: 'desc' },
      })) ||
      (await prisma.youTubeSession.findFirst({
        where: { google_email: { not: null } },
        orderBy: { updated_at: 'desc' },
      }));

    if (session) {
      return {
        email: session.google_email,
        password: tryDecryptString(session.google_password_enc),
        totpSecret: tryDecryptString(session.google_totp_secret_enc),
      };
    }

    // Fallback: env (backward-compat)
    return {
      email: process.env.GOOGLE_EMAIL || null,
      password: process.env.GOOGLE_PASSWORD || null,
      totpSecret: process.env.GOOGLE_TOTP_SECRET || null,
    };
  }

  /**
   * Trạng thái credentials cho FE — KHÔNG trả password/secret thô.
   */
  static async getGoogleLoginStatus(): Promise<GoogleLoginCredentialsStatus> {
    const session = await prisma.youTubeSession.findFirst({
      where: { google_email: { not: null } },
      orderBy: { updated_at: 'desc' },
    });

    if (!session) {
      // Fallback env: vẫn show email nếu có env
      return {
        email: process.env.GOOGLE_EMAIL || null,
        hasPassword: !!process.env.GOOGLE_PASSWORD,
        hasTotpSecret: !!process.env.GOOGLE_TOTP_SECRET,
        password: process.env.GOOGLE_PASSWORD || null,
        totpSecret: process.env.GOOGLE_TOTP_SECRET || null,
        autoLoginEnabled: !!(process.env.GOOGLE_EMAIL && process.env.GOOGLE_PASSWORD),
        lastResult: null,
        lastAttemptAt: null,
      };
    }

    return {
      email: session.google_email,
      hasPassword: !!session.google_password_enc,
      hasTotpSecret: !!session.google_totp_secret_enc,
      password: tryDecryptString(session.google_password_enc),
      totpSecret: tryDecryptString(session.google_totp_secret_enc),
      autoLoginEnabled: session.auto_login_enabled,
      lastResult: session.auto_login_result,
      lastAttemptAt: session.auto_login_at,
    };
  }

  /**
   * Cập nhật credentials. Chỉ field được truyền mới update (partial).
   * `adminId`: nếu chưa có YouTubeSession cho admin này, sẽ tạo mới.
   * Nếu không truyền adminId, dùng admin đầu tiên có sẵn.
   */
  static async updateGoogleLogin(
    adminId: string | null,
    input: UpdateGoogleLoginInput,
  ): Promise<GoogleLoginCredentialsStatus> {
    // Xác định admin để gắn session
    let targetAdminId = adminId;
    if (!targetAdminId) {
      const anyAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN', is_active: true },
        select: { id: true },
      });
      if (!anyAdmin) throw new Error('Không tìm thấy admin nào để lưu credentials');
      targetAdminId = anyAdmin.id;
    }

    const data: any = {};
    if (input.email !== undefined) data.google_email = input.email;
    if (input.password !== undefined) {
      data.google_password_enc = input.password ? encryptString(input.password) : null;
    }
    if (input.totpSecret !== undefined) {
      const cleaned = input.totpSecret ? input.totpSecret.replace(/\s+/g, '') : null;
      data.google_totp_secret_enc = cleaned ? encryptString(cleaned) : null;
    }
    if (input.autoLoginEnabled !== undefined) data.auto_login_enabled = input.autoLoginEnabled;

    await prisma.youTubeSession.upsert({
      where: { admin_id: targetAdminId },
      update: data,
      create: { admin_id: targetAdminId, ...data },
    });

    logger.info(
      `[Settings] Cập nhật Google login cho admin ${targetAdminId}: ` +
        `${Object.keys(data).join(', ')}`,
    );

    return this.getGoogleLoginStatus();
  }

  /**
   * Ghi nhận kết quả lần auto-login gần nhất + cập nhật is_logged_in.
   */
  static async recordLoginAttempt(success: boolean, message: string): Promise<void> {
    const session = await prisma.youTubeSession.findFirst({
      where: { auto_login_enabled: true },
      orderBy: { updated_at: 'desc' },
    });
    if (!session) return;

    const now = new Date();
    await prisma.youTubeSession.update({
      where: { id: session.id },
      data: {
        auto_login_result: `${success ? 'OK' : 'FAIL'}: ${message}`.substring(0, 200),
        auto_login_at: now,
        is_logged_in: success,
        ...(success
          ? { verified_at: now, disconnected_at: null, disconnect_reason: null }
          : { disconnected_at: now, disconnect_reason: message.substring(0, 500) }),
      },
    });
  }

  /**
   * Cập nhật trạng thái session (is_logged_in) — gọi từ scrape services hoặc check thủ công.
   */
  static async markSessionStatus(loggedIn: boolean, reason?: string): Promise<void> {
    const session = await prisma.youTubeSession.findFirst({
      where: { google_email: { not: null } },
      orderBy: { updated_at: 'desc' },
    });
    if (!session) return;

    const now = new Date();
    await prisma.youTubeSession.update({
      where: { id: session.id },
      data: {
        is_logged_in: loggedIn,
        ...(loggedIn
          ? { verified_at: now, disconnected_at: null, disconnect_reason: null }
          : { disconnected_at: now, disconnect_reason: (reason || 'unknown').substring(0, 500) }),
      },
    });
  }

  /** Đọc trạng thái session từ DB — cho FE poll nhẹ (không mở browser). */
  static async getSessionStatus(): Promise<{
    isLoggedIn: boolean;
    verifiedAt: Date | null;
    disconnectedAt: Date | null;
    disconnectReason: string | null;
  }> {
    const session = await prisma.youTubeSession.findFirst({
      where: { google_email: { not: null } },
      orderBy: { updated_at: 'desc' },
    });
    if (!session) {
      return { isLoggedIn: false, verifiedAt: null, disconnectedAt: null, disconnectReason: null };
    }
    return {
      isLoggedIn: session.is_logged_in,
      verifiedAt: session.verified_at,
      disconnectedAt: session.disconnected_at,
      disconnectReason: session.disconnect_reason,
    };
  }
}
