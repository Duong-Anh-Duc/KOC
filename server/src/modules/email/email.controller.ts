import { NextFunction, Request, Response } from 'express';
import { EmailService } from './email.service';
import { ProgressService } from '../shared/progress.service';
import { AuthenticatedRequest } from '../../types';
import { getAccessScope } from '../../utils/access-scope';
import { AuditLogService } from '../audit/audit.service';

export class EmailController {
  /**
   * GET /api/email/config
   * Get email configuration
   */
  static async getConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const emailConfig = await EmailService.getConfig();
      const t = (_req as any).t;

      res.status(200).json({
        success: true,
        message: t ? t('email.configRetrieved') : 'Email configuration retrieved',
        data: emailConfig,
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
        data: newConfig,
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
        res.status(400).json({ success: false, message: t ? t('email.emailRequired') : 'Email address is required' });
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
      const { month, kocIds } = req.body;

      if (!month) {
        res.status(400).json({ success: false, message: t ? t('email.monthRequired') : 'Month is required (e.g. 01/2026)' });
        return;
      }

      const taskId = ProgressService.generateTaskId('send-emails');

      res.status(202).json({
        success: true,
        message: t ? t('progress.taskStarted') : 'Task started',
        data: { taskId },
      });

      const scope = await getAccessScope(req);
      let selectedKocIds = Array.isArray(kocIds) && kocIds.length > 0 ? kocIds as string[] : undefined;

      // Intersect selectedKocIds with allowedKocIds for ACCOUNTANT
      if (scope.allowedKocIds) {
        selectedKocIds = selectedKocIds
          ? selectedKocIds.filter(id => scope.allowedKocIds!.includes(id))
          : scope.allowedKocIds;
      }

      // Run in background
      EmailController.runSendRevenueEmails(month, taskId, req.user?.userId || null, scope.adminId, selectedKocIds, t).catch(err => {
        ProgressService.error(taskId, err.message);
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Background method to send revenue emails with progress
   */
  private static async runSendRevenueEmails(month: string, taskId: string, userId: string | null, adminId?: string, kocIds?: string[], t?: (key: string, opts?: Record<string, unknown>) => string): Promise<void> {
    try {
      const results = await EmailService.sendAllRevenueEmails(month, adminId, (step, total, kocName) => {
        const percent = Math.round((step / total) * 100);
        ProgressService.emit(taskId, {
          step, total, percent,
          message: t ? t('progress.sendingEmail', { name: kocName, current: step, total }) : `Sending email to ${kocName} (${step}/${total})`,
        });
      }, kocIds);

      // Audit log
      if (userId) {
        try {
          await AuditLogService.log(
            userId,
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
      }

      ProgressService.complete(taskId, {
        month,
        sent: results.sent,
        failed: results.failed,
        skipped: results.skipped,
        summary: {
          totalSent: results.sent.length,
          totalFailed: results.failed.length,
          totalSkipped: results.skipped.length,
        },
      });
    } catch (error: any) {
      ProgressService.error(taskId, error.message);
    }
  }

  /**
   * GET /api/email/cycles
   * Get list of available cycles for sending emails
   */
  static async getAvailableCycles(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const t = (_req as any).t;
      const { default: prisma } = await import('../../config/database');

      const authReq = _req as import('../../types').AuthenticatedRequest;
      const scope = await getAccessScope(authReq);

      const cycles = await (prisma as any).revenueCycle.findMany({
        where: scope.adminId ? { admin_id: scope.adminId } : {},
        select: {
          id: true,
          month: true,
          status: true,
          _count: {
            select: { revenue_records: true },
          },
        },
      });

      // Sort by month (MM/YYYY) descending — newest month first
      cycles.sort((a: any, b: any) => {
        const [mm1, yyyy1] = a.month.split('/');
        const [mm2, yyyy2] = b.month.split('/');
        return (parseInt(yyyy2) * 100 + parseInt(mm2)) - (parseInt(yyyy1) * 100 + parseInt(mm1));
      });

      res.status(200).json({
        success: true,
        message: t ? t('email.cyclesRetrieved') : 'Cycles retrieved',
        data: cycles.map((c: any) => ({
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
