"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsController = void 0;
const services_1 = require("../services");
const progress_service_1 = require("../services/progress.service");
class StatsController {
    /**
     * GET /api/stats/:kocId
     */
    static async getHistory(req, res, next) {
        try {
            const days = req.query.days ? Number(req.query.days) : 30;
            const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;
            const stats = await services_1.SocialBladeService.getStatsHistory(kocId, days);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('stats.retrieved') : 'Channel stats retrieved',
                data: stats,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/stats/:kocId/fetch
     */
    static async fetchStats(req, res, next) {
        try {
            const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;
            const adminId = req.user?.userId;
            const record = await services_1.SocialBladeService.recordStats(kocId, adminId);
            const t = req.t;
            res.status(201).json({
                success: true,
                message: t ? t('stats.fetched') : 'Channel stats fetched and saved',
                data: record,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/stats/fetch-all
     * Returns immediately with taskId; runs fetch in background with SSE progress.
     */
    static async fetchAllStats(_req, res, next) {
        try {
            const adminId = _req.user?.userId;
            const taskId = progress_service_1.ProgressService.generateTaskId('stats');
            // Respond immediately with taskId
            res.status(202).json({
                success: true,
                message: 'Stats fetch started',
                data: { taskId },
            });
            // Run in background
            services_1.SocialBladeService.recordAllStatsWithProgress(taskId, adminId).catch(() => {
                // Error handled inside service
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/stats/latest
     */
    static async getLatest(_req, res, next) {
        try {
            const adminId = _req.user?.role === 'ADMIN' ? _req.user?.userId : undefined;
            const stats = await services_1.SocialBladeService.getLatestStats(adminId);
            const t = _req.t;
            res.status(200).json({
                success: true,
                message: t ? t('stats.latestRetrieved') : 'Latest stats retrieved',
                data: stats,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/stats/:kocId/growth
     * Returns detailed YT Studio analytics for a single KOC
     */
    static async getGrowth(req, res, next) {
        try {
            const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;
            const detail = await services_1.SocialBladeService.getKocDetail(kocId);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('stats.growthCalculated') : 'Growth calculated',
                data: detail,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/stats/growth/all
     * Returns YT Studio analytics for all KOCs
     */
    static async getAllGrowth(_req, res, next) {
        try {
            const adminId = _req.user?.role === 'ADMIN' ? _req.user?.userId : undefined;
            const growthData = await services_1.SocialBladeService.getAllKocsGrowth(adminId);
            const t = _req.t;
            res.status(200).json({
                success: true,
                message: t ? t('stats.growthCalculated') : 'Growth calculated for all KOCs',
                data: growthData,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/stats/:kocId/correlation?months=6
     */
    static async getCorrelation(req, res, next) {
        try {
            const kocId = Array.isArray(req.params.kocId) ? req.params.kocId[0] : req.params.kocId;
            const months = req.query.months ? Number(req.query.months) : 6;
            const data = await services_1.SocialBladeService.getCorrelation(kocId, months);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('stats.correlationCalculated') : 'Correlation data calculated',
                data,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.StatsController = StatsController;
//# sourceMappingURL=stats.controller.js.map