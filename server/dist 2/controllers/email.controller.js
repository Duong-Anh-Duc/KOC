"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailController = void 0;
const services_1 = require("../services");
const email_service_1 = require("../services/email.service");
const progress_service_1 = require("../services/progress.service");
class EmailController {
    /**
     * GET /api/email/config
     * Get email configuration
     */
    static async getConfig(_req, res, next) {
        try {
            const emailConfig = await email_service_1.EmailService.getConfig();
            const t = _req.t;
            res.status(200).json({
                success: true,
                message: t ? t('email.configRetrieved') : 'Email configuration retrieved',
                data: emailConfig,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PUT /api/email/config
     * Update email configuration
     */
    static async updateConfig(req, res, next) {
        try {
            const t = req.t;
            const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, fromName, fromEmail, autoSendAfterCron } = req.body;
            const updateData = {};
            if (smtpHost !== undefined)
                updateData.smtpHost = smtpHost;
            if (smtpPort !== undefined)
                updateData.smtpPort = smtpPort;
            if (smtpSecure !== undefined)
                updateData.smtpSecure = smtpSecure;
            if (smtpUser !== undefined)
                updateData.smtpUser = smtpUser;
            if (smtpPass !== undefined && smtpPass !== '********')
                updateData.smtpPass = smtpPass;
            if (fromName !== undefined)
                updateData.fromName = fromName;
            if (fromEmail !== undefined)
                updateData.fromEmail = fromEmail;
            if (autoSendAfterCron !== undefined)
                updateData.autoSendAfterCron = autoSendAfterCron;
            const oldConfig = await email_service_1.EmailService.getConfig();
            const newConfig = await email_service_1.EmailService.updateConfig(updateData);
            // Audit log
            try {
                await services_1.AuditLogService.log(req.user?.userId || null, 'UPDATE_EMAIL_CONFIG', 'SYSTEM_CONFIG', 'email_config', { ...oldConfig, smtpPass: '***' }, { ...newConfig, smtpPass: '***' });
            }
            catch (auditError) {
                console.error('Failed to create audit log:', auditError);
            }
            res.status(200).json({
                success: true,
                message: t ? t('email.configUpdated') : 'Email configuration updated',
                data: newConfig,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/email/test
     * Send a test email
     */
    static async sendTestEmail(req, res, next) {
        try {
            const t = req.t;
            const { email } = req.body;
            if (!email) {
                res.status(400).json({ success: false, message: t ? t('email.emailRequired') : 'Email address is required' });
                return;
            }
            const result = await email_service_1.EmailService.sendTestEmail(email);
            res.status(result.success ? 200 : 500).json({
                success: result.success,
                message: result.success
                    ? (t ? t('email.testSent') : 'Test email sent successfully')
                    : (t ? t('email.testFailed') : `Failed to send test email: ${result.error}`),
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/email/send-revenue
     * Send revenue emails to all KOCs for a specific month
     */
    static async sendRevenueEmails(req, res, next) {
        try {
            const t = req.t;
            const { month } = req.body;
            if (!month) {
                res.status(400).json({ success: false, message: t ? t('email.monthRequired') : 'Month is required (e.g. 01/2026)' });
                return;
            }
            const taskId = progress_service_1.ProgressService.generateTaskId('send-emails');
            res.status(202).json({
                success: true,
                message: t ? t('progress.taskStarted') : 'Task started',
                data: { taskId },
            });
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            // Run in background
            EmailController.runSendRevenueEmails(month, taskId, req.user?.userId || null, adminId).catch(err => {
                progress_service_1.ProgressService.error(taskId, err.message);
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Background method to send revenue emails with progress
     */
    static async runSendRevenueEmails(month, taskId, userId, adminId) {
        try {
            const results = await email_service_1.EmailService.sendAllRevenueEmails(month, adminId, (step, total, kocName) => {
                const percent = Math.round((step / total) * 100);
                progress_service_1.ProgressService.emit(taskId, {
                    step, total, percent,
                    message: `Sending email to ${kocName} (${step}/${total})`,
                });
            });
            // Audit log
            if (userId) {
                try {
                    await services_1.AuditLogService.log(userId, 'SEND_REVENUE_EMAILS', 'SYSTEM_CONFIG', 'email_revenue', null, {
                        month,
                        sent: results.sent.length,
                        failed: results.failed.length,
                        skipped: results.skipped.length,
                    });
                }
                catch (auditError) {
                    console.error('Failed to create audit log:', auditError);
                }
            }
            progress_service_1.ProgressService.complete(taskId, {
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
        }
        catch (error) {
            progress_service_1.ProgressService.error(taskId, error.message);
        }
    }
    /**
     * GET /api/email/cycles
     * Get list of available cycles for sending emails
     */
    static async getAvailableCycles(_req, res, next) {
        try {
            const t = _req.t;
            const { default: prisma } = await Promise.resolve().then(() => __importStar(require('../config/database')));
            const authReq = _req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const cycles = await prisma.revenueCycle.findMany({
                where: adminId ? { admin_id: adminId } : {},
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
                data: cycles.map((c) => ({
                    id: c.id,
                    month: c.month,
                    status: c.status,
                    recordCount: c._count.revenue_records,
                })),
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.EmailController = EmailController;
//# sourceMappingURL=email.controller.js.map