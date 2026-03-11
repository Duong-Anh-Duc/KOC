"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KOCService = void 0;
const database_1 = __importDefault(require("../config/database"));
const constants_1 = require("../constants");
const middlewares_1 = require("../middlewares");
class KOCService {
    /**
     * Get all KOCs with pagination & search
     * If adminId is provided, only return KOCs managed by that admin
     */
    static async getAll(query) {
        const page = query.page || constants_1.PAGINATION.DEFAULT_PAGE;
        const limit = Math.min(query.limit || constants_1.PAGINATION.DEFAULT_LIMIT, constants_1.PAGINATION.MAX_LIMIT);
        const skip = (page - 1) * limit;
        const where = {};
        // Filter by admin
        if (query.adminId) {
            where.admin_id = query.adminId;
        }
        // Search filter
        if (query.search) {
            where.OR = [
                { full_name: { contains: query.search, mode: 'insensitive' } },
                { channel_name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        const [data, total] = await Promise.all([
            database_1.default.kOC.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [query.sortBy || 'created_at']: query.sortOrder || 'desc' },
            }),
            database_1.default.kOC.count({ where }),
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
    /**
     * Get KOC by ID (scoped to admin if adminId provided)
     */
    static async getById(id, adminId) {
        const koc = await database_1.default.kOC.findUnique({
            where: { id },
            include: {
                revenue_records: {
                    include: { cycle: { select: { month: true, exchange_rate: true } } },
                    orderBy: { created_at: 'desc' },
                    take: 12,
                },
                channel_stats: {
                    orderBy: { recorded_at: 'desc' },
                    take: 30,
                },
            },
        });
        if (!koc)
            throw new middlewares_1.ApiError(404, 'koc.notFound');
        if (adminId && koc.admin_id !== adminId)
            throw new middlewares_1.ApiError(403, 'koc.notYours');
        return koc;
    }
    /**
     * Create a new KOC
     */
    static async create(data) {
        const koc = await database_1.default.kOC.create({
            data: {
                full_name: data.full_name,
                channel_name: data.channel_name,
                youtube_channel_id: data.youtube_channel_id,
                email: data.email,
                phone: data.phone,
                bank_account_number: data.bank_account_number,
                bank_name: data.bank_name,
                tax_code: data.tax_code,
                base_rate: data.base_rate ?? 0.8,
                min_payment: data.min_payment ?? 100,
                pub_code: data.pub_code || null,
                admin_id: data.admin_id || null,
            },
        });
        return koc;
    }
    /**
     * Update a KOC
     */
    static async update(id, data) {
        console.log('💾 KOCService.update - Input data:', JSON.stringify(data, null, 2));
        console.log('💾 KOCService.update - min_payment in data:', data.min_payment, 'type:', typeof data.min_payment);
        const existing = await database_1.default.kOC.findUnique({ where: { id } });
        if (!existing)
            throw new middlewares_1.ApiError(404, 'koc.notFound');
        const oldValue = { ...existing };
        // Note: admin ownership is checked at controller level
        console.log('💾 KOCService.update - Old min_payment:', oldValue.min_payment);
        const updated = await database_1.default.kOC.update({
            where: { id },
            data,
        });
        console.log('💾 KOCService.update - Updated min_payment:', updated.min_payment, 'type:', typeof updated.min_payment);
        return { koc: updated, oldValue };
    }
    /**
     * Delete a KOC (soft delete by setting INACTIVE, or hard delete)
     */
    static async delete(id, adminId) {
        const koc = await database_1.default.kOC.findUnique({ where: { id } });
        if (!koc)
            throw new middlewares_1.ApiError(404, 'koc.notFound');
        if (adminId && koc.admin_id !== adminId)
            throw new middlewares_1.ApiError(403, 'koc.notYours');
        // Check if KOC has any revenue records
        const recordCount = await database_1.default.revenueRecord.count({ where: { koc_id: id } });
        if (recordCount > 0) {
            // Soft delete - set INACTIVE
            return database_1.default.kOC.update({
                where: { id },
                data: { status: 'INACTIVE' },
            });
        }
        // Hard delete if no records
        await database_1.default.kOC.delete({ where: { id } });
        return koc;
    }
    /**
     * Get all active KOCs (for dropdowns/selects)
     * If adminId is provided, only return KOCs managed by that admin
     */
    static async getActiveKOCs(adminId) {
        const where = { status: 'ACTIVE' };
        if (adminId) {
            where.admin_id = adminId;
        }
        return database_1.default.kOC.findMany({
            where,
            select: {
                id: true,
                full_name: true,
                channel_name: true,
                base_rate: true,
                admin_id: true,
            },
            orderBy: { full_name: 'asc' },
        });
    }
}
exports.KOCService = KOCService;
//# sourceMappingURL=koc.service.js.map