"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditController = void 0;
const services_1 = require("../services");
class AuditController {
    /**
     * GET /api/audit-logs
     * Admin only sees logs from their own actions
     */
    static async getLogs(req, res, next) {
        try {
            const { page, limit, entity, entity_id, user_id, action } = req.query;
            const authReq = req;
            // Admin: force filter to own user_id; others: allow filter param
            const effectiveUserId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : user_id;
            const result = await services_1.AuditLogService.getLogs({
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                entity: entity,
                action: action,
                entityId: entity_id,
                userId: effectiveUserId,
            });
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('audit.retrieved') : 'Audit logs retrieved',
                data: result.data,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuditController = AuditController;
//# sourceMappingURL=audit.controller.js.map