"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const services_1 = require("../services");
class DashboardController {
    /**
     * GET /api/dashboard/overview
     */
    static async getOverview(_req, res, next) {
        try {
            const authReq = _req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const overview = await services_1.DashboardService.getOverview(adminId);
            const t = _req.t;
            res.status(200).json({
                success: true,
                message: t ? t('dashboard.overview') : 'Dashboard overview',
                data: overview,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/dashboard/revenue-trend
     */
    static async getRevenueTrend(req, res, next) {
        try {
            const limit = req.query.limit ? Number(req.query.limit) : 12;
            const authReq = req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const trend = await services_1.DashboardService.getRevenueTrend(limit, adminId);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('dashboard.revenueTrend') : 'Revenue trend data',
                data: trend,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=dashboard.controller.js.map