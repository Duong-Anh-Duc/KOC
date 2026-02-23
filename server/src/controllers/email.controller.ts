import { NextFunction, Request, Response } from 'express';
import { AuditLogService } from '../services';
import { EmailService } from '../services/email.service';
import { AuthenticatedRequest } from '../types';

export class EmailController {
  /**
   * GET /api/email/config
   * Get email configuration
   */
  static async getConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const emailConfig = await EmailService.getConfig();
      const t = (_req as any).t;

      // Don't expose SMTP password
      const safeConfig = {
        ...emailConfig,
        smtpPass: emailConfig.smtpPass ? '********' : '',
      };

      res.status(200).json({
        success: true,
        message: t ? t('email.configRetrieved') : 'Email configuration retrieved',
        data: safeConfig,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/email/config
   * Update email configuration
   */
  static async updateConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, fromName, fromEmail, autoSendAfterCron } = req.body;

      const updateData: Record<string, any> = {};
      if (smtpHost !== undefined) updateData.smtpHost = smtpHost;
      if (smtpPort !== undefined) updateData.smtpPort = smtpPort;
      if (smtpSecure !== undefined) updateData.smtpSecure = smtpSecure;
      if (smtpUser !== undefined) updateData.smtpUser = smtpUser;
      if (smtpPass !== undefined && smtpPass !== '********') updateData.smtpPass = smtpPass;
      if (fromName !== undefined) updateData.fromName = fromName;
      if (fromEmail !== undefined) updateData.fromEmail = fromEmail;
      if (autoSendAfterCron !== undefined) updateData.autoSendAfterCron = autoSendAfterCron;

      const oldConfig = await EmailService.getConfig();
      const newConfig = await EmailService.updateConfig(updateData);

      // Audit log
      try {
        await AuditLogService.log(
          req.user?.userId || null,
          'UPDATE_EMAIL_CONFIG',
          'SYSTEM_CONFIG',
          'email_config',
          { ...oldConfig, smtpPass: '***' } as unknown as Record<string, unknown>,
          { ...newConfig, smtpPass: '***' } as unknown as Record<string, unknown>
        );
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError);
      }

      res.status(200).json({
        success: true,
        message: t ? t('email.configUpdated') : 'Email configuration updated',
        data: { ...newConfig, smtpPass: newConfig.smtpPass ? '********' : '' },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/email/test
   * Send a test email
   */
  static async sendTestEmail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ success: false, message: 'Email address is required' });
        return;
      }

      const result = await EmailService.sendTestEmail(email);

      res.status(result.success ? 200 : 500).json({
        success: result.success,
        message: result.success
          ? (t ? t('email.testSent') : 'Test email sent successfully')
          : (t ? t('email.testFailed') : `Failed to send test email: ${result.error}`),
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/email/send-revenue
   * Send revenue emails to all KOCs for a specific month
   */
  static async sendRevenueEmails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (req as any).t;
      const { month } = req.body;

      if (!month) {
        res.status(400).json({ success: false, message: 'Month is required (e.g. 01/2026)' });
        return;
      }

      const results = await EmailService.sendAllRevenueEmails(month);

      // Audit log
      try {
        await AuditLogService.log(
          req.user?.userId || null,
          'SEND_REVENUE_EMAILS',
          'SYSTEM_CONFIG',
          'email_revenue',
          null,
          {
            month,
            sent: results.sent.length,
            failed: results.failed.length,
            skipped: results.skipped.length,
          } as unknown as Record<string, unknown>
        );
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError);
      }

      res.status(200).json({
        success: true,
        message: t
          ? t('email.revenueSent', { sent: results.sent.length, failed: results.failed.length, skipped: results.skipped.length })
          : `Revenue emails: ${results.sent.length} sent, ${results.failed.length} failed, ${results.skipped.length} skipped`,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/email/cycles
   * Get list of available cycles for sending emails
   */
  static async getAvailableCycles(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (_req as any).t;
      const { default: prisma } = await import('../config/database');

      const cycles = await prisma.revenueCycle.findMany({
        orderBy: { month: 'desc' },
        select: {
          id: true,
          month: true,
          status: true,
          _count: {
            select: { revenue_records: true },
          },
        },
      });

      res.status(200).json({
        success: true,
        message: t ? t('email.cyclesRetrieved') : 'Cycles retrieved',
        data: cycles.map(c => ({
          id: c.id,
          month: c.month,
          status: c.status,
          recordCount: c._count.revenue_records,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}
