import { Decimal } from '@prisma/client/runtime/library';
import nodemailer from 'nodemailer';
import * as path from 'path';
import { config } from '../config';
import prisma from '../config/database';
import logger from '../middlewares/logger.middleware';
import { buildRevenueEmailHtml, RevenueEmailData } from './email-templates';
import { RevenueService } from './revenue.service';

// ============================================================
// Types
// ============================================================

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  /** Auto-send email after cron completes */
  autoSendAfterCron: boolean;
}

const EMAIL_CONFIG_KEY = 'email_config';

const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  smtpHost: config.smtp.host,
  smtpPort: config.smtp.port,
  smtpSecure: config.smtp.secure,
  smtpUser: config.smtp.user,
  smtpPass: config.smtp.pass,
  fromName: config.smtp.fromName,
  fromEmail: config.smtp.fromEmail,
  autoSendAfterCron: false,
};

// ============================================================
// Helper: Convert Decimal to number
// ============================================================
function toNum(val: Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString());
}

// ============================================================
// Email Service
// ============================================================
export class EmailService {
  /**
   * Get email configuration from DB or defaults
   */
  static async getConfig(): Promise<EmailConfig> {
    const stored = await prisma.systemConfig.findUnique({
      where: { key: EMAIL_CONFIG_KEY },
    });
    if (!stored) return { ...DEFAULT_EMAIL_CONFIG };
    return { ...DEFAULT_EMAIL_CONFIG, ...(stored.value as unknown as Partial<EmailConfig>) };
  }

  /**
   * Update email configuration
   */
  static async updateConfig(newConfig: Partial<EmailConfig>): Promise<EmailConfig> {
    const current = await this.getConfig();
    const merged: EmailConfig = { ...current, ...newConfig };

    await prisma.systemConfig.upsert({
      where: { key: EMAIL_CONFIG_KEY },
      update: { value: merged as any },
      create: { key: EMAIL_CONFIG_KEY, value: merged as any },
    });

    return merged;
  }

  /**
   * Create a nodemailer transporter from the current config
   */
  static async createTransporter() {
    const emailConfig = await this.getConfig();

    if (!emailConfig.smtpUser || !emailConfig.smtpPass) {
      throw new Error('SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS.');
    }

    return nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.smtpSecure,
      auth: {
        user: emailConfig.smtpUser,
        pass: emailConfig.smtpPass,
      },
      connectionTimeout: 15000,  // 15s to establish connection
      socketTimeout: 30000,      // 30s for each socket operation
      greetingTimeout: 10000,    // 10s for SMTP greeting
    });
  }

  /**
   * Send a test email
   */
  static async sendTestEmail(toEmail: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const emailConfig = await this.getConfig();
      const transporter = await this.createTransporter();

      const result = await transporter.sendMail({
        from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
        to: toEmail,
        subject: '[EBE CMS] Email kiểm tra',
        html: `
          <div style="padding: 40px; text-align: center; font-family: sans-serif;">
            <h2 style="color: #ED8F3A;">Kết nối email thành công!</h2>
            <p>Email này xác nhận rằng hệ thống EBE CMS đã được cấu hình SMTP chính xác.</p>
            <p style="color: #888; font-size: 13px;">Thời gian gửi: ${new Date().toLocaleString('vi-VN')}</p>
          </div>
        `,
      });

      logger.info(`[EmailService] Test email sent to ${toEmail}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send test email: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Alert admin when YouTube Studio session expires
   */
  static async sendSessionExpiredAlert(adminEmail: string, retries = 2): Promise<void> {
    try {
      const transporter = await this.createTransporter();
      const emailConfig = await this.getConfig();
      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      const vncUrl = `${process.env.VNC_URL || 'http://46.62.170.132:6080'}/vnc.html`;

      await transporter.sendMail({
        from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
        to: adminEmail,
        subject: '[EBE CMS] Cookie YouTube Studio đã hết hạn',
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: auto; padding: 32px;">
            <h2 style="color: #ff4d4f;">Phiên YouTube Studio đã hết hạn</h2>
            <p>Cookie kết nối với YouTube Studio đã hết hạn. Hệ thống <strong>không thể cào dữ liệu</strong> cho đến khi bạn đăng nhập lại.</p>
            <p style="margin-top: 24px;">Thời gian phát hiện: <strong>${new Date().toLocaleString('vi-VN')}</strong></p>
            <div style="margin-top: 28px; display: flex; gap: 12px;">
              <a href="${vncUrl}" style="background:#ED8F3A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
                Đăng nhập lại qua VNC
              </a>
              &nbsp;&nbsp;
              <a href="${appUrl}/cron-settings" style="background:#1677ff;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
                Vào trang cấu hình
              </a>
            </div>
            <p style="margin-top: 32px; color: #888; font-size: 12px;">EBE CMS — Thông báo tự động</p>
          </div>
        `,
      });
      logger.info(`[EmailService] Session expired alert sent to ${adminEmail}`);
    } catch (err: any) {
      logger.error(`[EmailService] Failed to send session alert: ${err.message}`);
      if (retries > 0) {
        logger.info(`[EmailService] Retrying session alert in 10s (${retries} left)...`);
        await new Promise(r => setTimeout(r, 10000));
        return this.sendSessionExpiredAlert(adminEmail, retries - 1);
      }
    }
  }

  /**
   * Send revenue report email to a single KOC
   */
  static async sendRevenueEmail(
    toEmail: string,
    data: RevenueEmailData
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const emailConfig = await this.getConfig();
      const transporter = await this.createTransporter();

      const html = buildRevenueEmailHtml(data);
      const logoPath = path.join(__dirname, '../assets/logo.jpg');

      const result = await transporter.sendMail({
        from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
        to: toEmail,
        subject: `[EBE] Báo cáo doanh thu tháng ${data.month} - ${data.channelName}`,
        html,
        attachments: [
          {
            filename: 'logo.jpg',
            path: logoPath,
            cid: 'logo@ebe', // Same as the cid reference in the HTML
          },
        ],
      });

      logger.info(`[EmailService] Revenue email sent to ${toEmail} for month ${data.month}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      logger.error(`[EmailService] Failed to send revenue email to ${toEmail}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send revenue emails to all KOCs for a specific cycle month
   * Returns summary of sent/failed
   */
  static async sendAllRevenueEmails(month: string, adminId?: string, onProgress?: (step: number, total: number, kocName: string) => void, kocIds?: string[]): Promise<{
    sent: Array<{ kocId: string; kocName: string; email: string }>;
    failed: Array<{ kocId: string; kocName: string; email: string; error: string }>;
    skipped: Array<{ kocId: string; kocName: string; reason: string }>;
  }> {
    const results = {
      sent: [] as Array<{ kocId: string; kocName: string; email: string }>,
      failed: [] as Array<{ kocId: string; kocName: string; email: string; error: string }>,
      skipped: [] as Array<{ kocId: string; kocName: string; reason: string }>,
    };

    // Find the cycle for this month (scoped to admin if provided)
    const cycle = await prisma.revenueCycle.findFirst({
      where: { month, ...(adminId ? { admin_id: adminId } : {}) },
      include: {
        revenue_records: {
          where: kocIds && kocIds.length > 0 ? { koc_id: { in: kocIds } } : undefined,
          include: {
            koc: true,
          },
        },
      },
    });

    if (!cycle) {
      logger.warn(`[EmailService] No cycle found for month ${month}`);
      return results;
    }

    const exchangeRate = toNum(cycle.exchange_rate);

    // Compute accumulated revenue from previous PENDING records (same logic as dashboard)
    const allKocIds = cycle.revenue_records.map(r => r.koc_id);
    const prevPendingRecords = allKocIds.length > 0
      ? await prisma.revenueRecord.findMany({
          where: { koc_id: { in: allKocIds }, status: 'PENDING', cycle_id: { lt: cycle.id } },
        })
      : [];

    // Sum previous PENDING revenue per KOC
    const prevOriginalByKoc = new Map<string, number>();
    const prevUsTaxByKoc = new Map<string, number>();
    for (const r of prevPendingRecords) {
      prevOriginalByKoc.set(r.koc_id, (prevOriginalByKoc.get(r.koc_id) ?? 0) + Number(r.original_revenue_usd));
      prevUsTaxByKoc.set(r.koc_id, (prevUsTaxByKoc.get(r.koc_id) ?? 0) + Number(r.us_tax_deduction));
    }

    for (let i = 0; i < cycle.revenue_records.length; i++) {
      const record = cycle.revenue_records[i];
      const koc = record.koc;

      if (onProgress) {
        onProgress(i + 1, cycle.revenue_records.length, koc.full_name);
      }

      // Skip if KOC has no email
      if (!koc.email) {
        results.skipped.push({
          kocId: koc.id,
          kocName: koc.full_name,
          reason: 'email.noEmailAddress',
        });
        continue;
      }

      // Use accumulated revenue (previous PENDING months + current) for email
      const prevOrig = prevOriginalByKoc.get(koc.id) ?? 0;
      const prevTax = prevUsTaxByKoc.get(koc.id) ?? 0;
      const round2 = (v: number) => Math.round(v * 100) / 100;
      const accRevenue = round2(prevOrig + toNum(record.original_revenue_usd));
      const accUsTax = round2(prevTax + toNum(record.us_tax_deduction));

      const accCalc = RevenueService.calculate({
        originalRevenueUsd: accRevenue,
        usTaxDeduction: accUsTax,
        baseRate: toNum(koc.base_rate),
        exchangeRate,
      });

      const emailData: RevenueEmailData = {
        kocName: koc.full_name,
        channelName: koc.channel_name,
        month,
        originalRevenue: accRevenue,
        usTaxDeduction: accCalc.us_tax_deduction,
        bankFee: accCalc.bank_fee,
        netRevenue: accCalc.net_revenue,
        companyShare: accCalc.company_share,
        kocReceiveUsd: accCalc.koc_receive_usd,
        kocReceiveVnd: accCalc.koc_receive_vnd,
        exchangeRate,
        baseRate: toNum(koc.base_rate),
        status: record.status,
      };

      const result = await this.sendRevenueEmail(koc.email, emailData);

      if (result.success) {
        results.sent.push({ kocId: koc.id, kocName: koc.full_name, email: koc.email });
      } else {
        results.failed.push({
          kocId: koc.id,
          kocName: koc.full_name,
          email: koc.email,
          error: result.error || 'Unknown error',
        });
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    logger.info(`[EmailService] Bulk email for month ${month}: ${results.sent.length} sent, ${results.failed.length} failed, ${results.skipped.length} skipped`);
    return results;
  }
}
