"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = void 0;
const database_1 = __importDefault(require("../config/database"));
class AuditLogService {
    /**
     * Create audit log entry
     */
    static async log(userId, action, entity, entityId, oldValue, newValue) {
        return database_1.default.auditLog.create({
            data: {
                user_id: userId,
                action,
                entity,
                entity_id: entityId,
                old_value: oldValue,
                new_value: newValue,
            },
        });
    }
    /**
     * Get audit logs with pagination
     */
    static async getLogs(options) {
        const page = options.page || 1;
        const limit = options.limit || 20;
        const skip = (page - 1) * limit;
        const where = {};
        if (options.entity)
            where.entity = options.entity;
        if (options.action)
            where.action = options.action;
        if (options.entityId)
            where.entity_id = options.entityId;
        if (options.userId)
            where.user_id = options.userId;
        const [data, total] = await Promise.all([
            database_1.default.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { timestamp: 'desc' },
                include: {
                    user: { select: { full_name: true, email: true } },
                },
            }),
            database_1.default.auditLog.count({ where }),
        ]);
        return {
            data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
exports.AuditLogService = AuditLogService;
//# sourceMappingURL=audit.service.js.map