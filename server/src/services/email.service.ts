import { Decimal } from '@prisma/client/runtime/library';
import nodemailer from 'nodemailer';
import * as path from 'path';
import { config } from '../config';
import prisma from '../config/database';
import logger from '../middlewares/logger.middleware';

// ============================================================
// Types
// ============================================================

interface RevenueEmailData {
  kocName: string;
  channelName: string;
  month: string; // e.g. "01/2026"
  originalRevenue: number;
  usTaxDeduction: number;
  bankFee: number;
  netRevenue: number;
  companyShare: number;
  kocReceiveUsd: number;
  kocReceiveVnd: number;
  exchangeRate: number;
  baseRate: number;
  status: string;
}

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
// Email HTML Template - Low Revenue (< $100)
// ============================================================
function buildLowRevenueEmailHtml(data: RevenueEmailData): string {
  const logoUrl = 'cid:logo@ebe';
  const formatUsd = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo cáo doanh thu tháng ${data.month}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f4ef; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f4ef;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #ED8F3A 0%, #f5a962 50%, #ffc655 100%); padding: 32px 40px; text-align: center;">
              <img src="${logoUrl}" alt="EBE Logo" width="60" height="60" style="display: block; margin: 0 auto 16px; border-radius: 12px; object-fit: contain;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">BÁO CÁO DOANH THU</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 16px; font-weight: 500;">Tháng ${data.month}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 16px;">
              <p style="margin: 0; font-size: 16px; color: #333333; line-height: 1.6;">
                Xin chào <strong style="color: #ED8F3A;">${data.kocName}</strong>,
              </p>
              <p style="margin: 12px 0 0; font-size: 15px; color: #555555; line-height: 1.6;">
                Dưới đây là báo cáo doanh thu kênh <strong>${data.channelName}</strong> trong tháng <strong>${data.month}</strong>.
              </p>
            </td>
          </tr>

          <!-- Low Revenue Notice -->
          <tr>
            <td style="padding: 8px 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border: 2px solid #f59e0b;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 40px;">⚠️</p>
                    <p style="margin: 0; font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Doanh thu chưa đạt ngưỡng</p>
                    <p style="margin: 12px 0 4px; font-size: 28px; color: #d97706; font-weight: 800;">${formatUsd(data.originalRevenue)}</p>
                    <p style="margin: 8px 0 0; font-size: 14px; color: #78350f; line-height: 1.6;">
                      Doanh thu tháng này chưa đạt mức tối thiểu <strong style="color: #b45309;">$100.00</strong><br/>
                      để được thanh toán và tính chia sẻ doanh thu.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Information -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f9ff; border-radius: 8px; border: 2px solid #3b82f6;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; font-size: 15px; color: #1e40af; font-weight: 600;">ℹ️ Thông tin quan trọng:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 14px; line-height: 1.8;">
                      <li>Doanh thu dưới $100 sẽ được cộng dồn sang tháng tiếp theo</li>
                      <li>Khi tổng doanh thu đạt $100 trở lên, hệ thống sẽ tính toán các khoản khấu trừ và chia sẻ doanh thu</li>
                      <li>Bạn sẽ nhận được email chi tiết khi doanh thu đạt ngưỡng thanh toán</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Encouragement -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ED8F3A 0%, #f5a962 100%); border-radius: 12px;">
                <tr>
                  <td style="padding: 20px 24px; text-align: center;">
                    <p style="margin: 0; font-size: 15px; color: #ffffff; font-weight: 600; line-height: 1.6;">
                      💪 Hãy tiếp tục cố gắng! Tháng sau sẽ tốt hơn!
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fef3e2; text-align: center; border-top: 1px solid #fde68a;">
              <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.6;">
                Đây là email tự động từ hệ thống <strong>EBE CMS</strong>.<br />
                Nếu có thắc mắc, vui lòng liên hệ quản trị viên.
              </p>
              <p style="margin: 12px 0 0; font-size: 12px; color: #b45309;">
                © ${new Date().getFullYear()} EBE CMS - Hệ thống Quản lý Nội dung
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================
// Email HTML Template
// ============================================================
function buildRevenueEmailHtml(data: RevenueEmailData): string {
  // If revenue is below $100, use simplified template
  if (data.originalRevenue < 100) {
    return buildLowRevenueEmailHtml(data);
  }

  // Use CID reference instead of data URI
  const logoUrl = 'cid:logo@ebe';

  const formatUsd = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatVnd = (val: number) => `${val.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₫`;

  const statusMap: Record<string, string> = {
    PENDING: 'Đang xử lý',
    APPROVED: 'Đã duyệt',
    PAID: 'Đã thanh toán',
  };
  const statusLabel = statusMap[data.status] || data.status;

  const statusColor: Record<string, string> = {
    PENDING: '#f59e0b',
    APPROVED: '#3b82f6',
    PAID: '#10b981',
  };
  const badgeColor = statusColor[data.status] || '#6b7280';

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo cáo doanh thu tháng ${data.month}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f4ef; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f4ef;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #ED8F3A 0%, #f5a962 50%, #ffc655 100%); padding: 32px 40px; text-align: center;">
              <img src="${logoUrl}" alt="EBE Logo" width="60" height="60" style="display: block; margin: 0 auto 16px; border-radius: 12px; object-fit: contain;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">BÁO CÁO DOANH THU</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 16px; font-weight: 500;">Tháng ${data.month}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 16px;">
              <p style="margin: 0; font-size: 16px; color: #333333; line-height: 1.6;">
                Xin chào <strong style="color: #ED8F3A;">${data.kocName}</strong>,
              </p>
              <p style="margin: 12px 0 0; font-size: 15px; color: #555555; line-height: 1.6;">
                Dưới đây là báo cáo chi tiết doanh thu kênh <strong>${data.channelName}</strong> trong tháng <strong>${data.month}</strong>.
              </p>
            </td>
          </tr>

          <!-- KOC Receive Highlight -->
          <tr>
            <td style="padding: 8px 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-radius: 12px; border: 2px solid #ED8F3A;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0; font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Số tiền nhận được</p>
                    <p style="margin: 8px 0 4px; font-size: 32px; color: #ED8F3A; font-weight: 800;">${formatUsd(data.kocReceiveUsd)}</p>
                    <p style="margin: 0; font-size: 20px; color: #b45309; font-weight: 600;">${formatVnd(data.kocReceiveVnd)}</p>
                    <span style="display: inline-block; margin-top: 12px; padding: 4px 16px; background-color: ${badgeColor}; color: #ffffff; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">${statusLabel}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Revenue Details Table -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <h3 style="margin: 0 0 16px; color: #333333; font-size: 16px; font-weight: 700; padding-bottom: 8px; border-bottom: 2px solid #ED8F3A;">
                📊 Chi tiết doanh thu
              </h3>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 16px; background-color: #fef3e2; color: #78350f; font-size: 14px; font-weight: 600; border-radius: 8px 8px 0 0;">Doanh thu gốc (USD)</td>
                  <td style="padding: 12px 16px; background-color: #fef3e2; color: #78350f; font-size: 14px; font-weight: 700; text-align: right; border-radius: 8px 8px 0 0;">${formatUsd(data.originalRevenue)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; color: #dc2626; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Thuế US (30%)</td>
                  <td style="padding: 12px 16px; color: #dc2626; font-size: 14px; text-align: right; border-bottom: 1px solid #f3f4f6;">- ${formatUsd(data.usTaxDeduction)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; color: #dc2626; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Phí ngân hàng</td>
                  <td style="padding: 12px 16px; color: #dc2626; font-size: 14px; text-align: right; border-bottom: 1px solid #f3f4f6;">- ${formatUsd(data.bankFee)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; color: #555555; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Doanh thu ròng</td>
                  <td style="padding: 12px 16px; color: #555555; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${formatUsd(data.netRevenue)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; color: #555555; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Phần công ty (${((1 - data.baseRate) * 100).toFixed(0)}%)</td>
                  <td style="padding: 12px 16px; color: #555555; font-size: 14px; text-align: right; border-bottom: 1px solid #f3f4f6;">- ${formatUsd(data.companyShare)}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; background-color: #fff7ed; color: #b45309; font-size: 15px; font-weight: 700; border-radius: 0 0 0 8px;">Creator nhận (USD)</td>
                  <td style="padding: 14px 16px; background-color: #fff7ed; color: #ED8F3A; font-size: 15px; font-weight: 800; text-align: right; border-radius: 0 0 8px 0;">${formatUsd(data.kocReceiveUsd)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Exchange Rate Info -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 13px; color: #6b7280;">
                          💱 Tỷ giá: <strong style="color: #333;">1 USD = ${data.exchangeRate.toLocaleString('vi-VN')} VND</strong>
                        </td>
                        <td style="font-size: 13px; color: #6b7280; text-align: right;">
                          📈 Tỷ lệ chia sẻ: <strong style="color: #333;">${(data.baseRate * 100).toFixed(0)}%</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- VND Total -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ED8F3A 0%, #f5a962 100%); border-radius: 12px;">
                <tr>
                  <td style="padding: 20px 24px; text-align: center;">
                    <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.85); text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Quy đổi VND</p>
                    <p style="margin: 8px 0 0; font-size: 28px; color: #ffffff; font-weight: 800;">${formatVnd(data.kocReceiveVnd)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fef3e2; text-align: center; border-top: 1px solid #fde68a;">
              <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.6;">
                Đây là email tự động từ hệ thống <strong>EBE CMS</strong>.<br />
                Nếu có thắc mắc, vui lòng liên hệ quản trị viên.
              </p>
              <p style="margin: 12px 0 0; font-size: 12px; color: #b45309;">
                © ${new Date().getFullYear()} EBE CMS - Hệ thống Quản lý Nội dung
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
            <h2 style="color: #ED8F3A;">✅ Kết nối email thành công!</h2>
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
  static async sendAllRevenueEmails(month: string, onProgress?: (step: number, total: number, kocName: string) => void): Promise<{
    sent: Array<{ kocId: string; kocName: string; email: string }>;
    failed: Array<{ kocId: string; kocName: string; email: string; error: string }>;
    skipped: Array<{ kocId: string; kocName: string; reason: string }>;
  }> {
    const results = {
      sent: [] as Array<{ kocId: string; kocName: string; email: string }>,
      failed: [] as Array<{ kocId: string; kocName: string; email: string; error: string }>,
      skipped: [] as Array<{ kocId: string; kocName: string; reason: string }>,
    };

    // Find the cycle for this month
    const cycle = await prisma.revenueCycle.findFirst({
      where: { month },
      include: {
        revenue_records: {
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
          reason: 'Không có email',
        });
        continue;
      }

      const emailData: RevenueEmailData = {
        kocName: koc.full_name,
        channelName: koc.channel_name,
        month,
        originalRevenue: toNum(record.original_revenue_usd),
        usTaxDeduction: toNum(record.us_tax_deduction),
        bankFee: toNum(record.bank_fee),
        netRevenue: toNum(record.net_revenue),
        companyShare: toNum(record.company_share),
        kocReceiveUsd: toNum(record.koc_receive_usd),
        kocReceiveVnd: toNum(record.koc_receive_vnd),
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
