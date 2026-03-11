"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KOCController = void 0;
const database_1 = __importDefault(require("../config/database"));
const constants_1 = require("../constants");
const services_1 = require("../services");
class KOCController {
    /**
     * GET /api/kocs
     * Admin users only see their own KOCs
     */
    static async getAll(req, res, next) {
        try {
            const { page, limit, search, sortBy, sortOrder } = req.query;
            const authReq = req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const result = await services_1.KOCService.getAll({
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                search: search,
                sortBy: sortBy,
                sortOrder: sortOrder,
                adminId,
            });
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('koc.listRetrieved') : 'KOCs retrieved',
                data: result.data,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/kocs/active
     * Admin users only see their own active KOCs
     */
    static async getActive(req, res, next) {
        try {
            const authReq = req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const kocs = await services_1.KOCService.getActiveKOCs(adminId);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('koc.activeRetrieved') : 'Active KOCs retrieved',
                data: kocs,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/kocs/:id
     */
    static async getById(req, res, next) {
        try {
            const authReq = req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const koc = await services_1.KOCService.getById(req.params.id, adminId);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('koc.retrieved') : 'KOC retrieved',
                data: koc,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/kocs
     * Automatically assigns the KOC to the creating admin
     */
    static async create(req, res, next) {
        try {
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const koc = await services_1.KOCService.create({ ...req.body, admin_id: adminId });
            // Audit log
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.CREATE_KOC, constants_1.ENTITIES.KOC, koc.id, null, { ...koc });
            }
            const t = req.t;
            res.status(201).json({
                success: true,
                message: t ? t('koc.created') : 'KOC created successfully',
                data: koc,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PUT /api/kocs/:id
     */
    static async update(req, res, next) {
        try {
            console.log('🔧 KOC UPDATE - Raw request body:', JSON.stringify(req.body, null, 2));
            console.log('🔧 KOC UPDATE - min_payment type:', typeof req.body.min_payment, 'value:', req.body.min_payment);
            // Check ownership before update
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            if (adminId) {
                await services_1.KOCService.getById(req.params.id, adminId); // throws 403 if not owner
            }
            const { koc, oldValue } = await services_1.KOCService.update(req.params.id, req.body);
            console.log('🔧 KOC UPDATE - After DB update, new min_payment:', koc.min_payment, 'type:', typeof koc.min_payment);
            // Audit log
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.UPDATE_KOC, constants_1.ENTITIES.KOC, koc.id, oldValue, { ...koc });
            }
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('koc.updated') : 'KOC updated successfully',
                data: koc,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * DELETE /api/kocs/:id
     */
    static async delete(req, res, next) {
        try {
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const koc = await services_1.KOCService.delete(req.params.id, adminId);
            // Audit log
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.DELETE_KOC, constants_1.ENTITIES.KOC, req.params.id, { ...koc }, null);
            }
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('koc.deleted') : 'KOC deleted successfully',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/kocs/accounts-status
     * Returns a map of koc_id → boolean indicating if they have a user account
     * Admin only sees their own KOCs' account status
     */
    static async getAccountsStatus(req, res, next) {
        try {
            const authReq = req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            // Get KOC IDs managed by this admin
            let kocFilter = { koc_id: { not: null } };
            if (adminId) {
                const managedKocIds = await database_1.default.kOC.findMany({
                    where: { admin_id: adminId },
                    select: { id: true },
                });
                const ids = managedKocIds.map(k => k.id);
                kocFilter = { koc_id: { in: ids } };
            }
            const usersWithKoc = await database_1.default.user.findMany({
                where: kocFilter,
                select: { koc_id: true },
            });
            const statusMap = {};
            for (const u of usersWithKoc) {
                if (u.koc_id)
                    statusMap[u.koc_id] = true;
            }
            res.status(200).json({
                success: true,
                data: statusMap,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.KOCController = KOCController;
//# sourceMappingURL=koc.controller.js.map