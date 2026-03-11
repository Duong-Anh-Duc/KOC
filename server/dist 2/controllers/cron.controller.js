"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronController = void 0;
const services_1 = require("../services");
const cron_service_1 = require("../services/cron.service");
class CronController {
    /**
     * GET /api/cron/config
     * Get current cron configuration
     */
    static async getConfig(_req, res, next) {
        try {
            const authReq = _req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const config = await cron_service_1.CronService.getConfig(adminId);
            const status = cron_service_1.CronService.getSchedulerStatus(adminId);
            const t = _req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cron.configRetrieved') : 'Cron configuration retrieved',
                data: {
                    ...config,
                    schedulerRunning: status.running,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PUT /api/cron/config
     * Update cron configuration
     */
    static async updateConfig(req, res, next) {
        try {
            const { enabled, schedule, autoCreateCycle, autoScrapeRevenue } = req.body;
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const oldConfig = await cron_service_1.CronService.getConfig(adminId);
            const newConfig = await cron_service_1.CronService.updateConfig({
                ...(enabled !== undefined && { enabled }),
                ...(schedule !== undefined && { schedule }),
                ...(autoCreateCycle !== undefined && { autoCreateCycle }),
                ...(autoScrapeRevenue !== undefined && { autoScrapeRevenue }),
            }, adminId);
            // Audit log (non-blocking)
            try {
                await services_1.AuditLogService.log(req.user?.userId || null, 'UPDATE_CRON_CONFIG', 'SYSTEM_CONFIG', 'cron_auto_cycle', oldConfig, newConfig);
            }
            catch (auditError) {
                console.error('Failed to create audit log:', auditError);
            }
            const status = cron_service_1.CronService.getSchedulerStatus(adminId);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cron.configUpdated') : 'Cron configuration updated',
                data: {
                    ...newConfig,
                    schedulerRunning: status.running,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/cron/run
     * Manually trigger the cron job
     */
    static async runNow(req, res, next) {
        try {
            const t = req.t;
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const result = await cron_service_1.CronService.runJob(adminId);
            // Audit log (non-blocking)
            try {
                await services_1.AuditLogService.log(req.user?.userId || null, 'RUN_CRON_JOB', 'SYSTEM_CONFIG', 'cron_auto_cycle', null, result);
            }
            catch (auditError) {
                console.error('Failed to create audit log:', auditError);
            }
            res.status(200).json({
                success: result.success,
                message: result.message,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/cron/history
     * Get cron run history
     */
    static async getHistory(_req, res, next) {
        try {
            const authReq = _req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const config = await cron_service_1.CronService.getConfig(adminId);
            const t = _req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cron.historyRetrieved') : 'Cron history retrieved',
                data: {
                    lastRunAt: config.lastRunAt || null,
                    lastRunResult: config.lastRunResult || null,
                    runHistory: config.runHistory || [],
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/cron/next-month
     * Preview what the next auto-cycle would create
     */
    static async previewNextRun(_req, res, next) {
        try {
            const { targetMonth, canRun, reason } = await cron_service_1.CronService.getNextCycleMonth();
            const authReq = _req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const config = await cron_service_1.CronService.getConfig(adminId);
            const t = _req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cron.previewRetrieved') : 'Preview retrieved',
                data: {
                    targetMonth,
                    canRun,
                    reason,
                    config: {
                        enabled: config.enabled,
                        schedule: config.schedule,
                        autoCreateCycle: config.autoCreateCycle,
                        autoScrapeRevenue: config.autoScrapeRevenue,
                    },
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CronController = CronController;
//# sourceMappingURL=cron.controller.js.map