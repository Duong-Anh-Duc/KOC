"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationSchema = exports.bulkCreateRevenueRecordSchema = exports.updateRevenueRecordSchema = exports.createRevenueRecordSchema = exports.updateCycleSchema = exports.createCycleSchema = exports.updateKOCSchema = exports.createKOCSchema = exports.createKocAccountSchema = exports.registerSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
// ============================================================
// AUTH VALIDATION
// ============================================================
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    full_name: zod_1.z.string().min(2, 'Full name is required'),
    role: zod_1.z.enum(['ADMIN', 'ACCOUNTANT', 'KOC']).optional(),
});
exports.createKocAccountSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
// ============================================================
// KOC VALIDATION
// ============================================================
exports.createKOCSchema = zod_1.z.object({
    full_name: zod_1.z.string().min(2, 'Full name is required'),
    channel_name: zod_1.z.string().min(1, 'Channel name is required'),
    youtube_channel_id: zod_1.z.string().min(1, 'YouTube channel ID is required'),
    email: zod_1.z.string().email('Invalid email format'),
    phone: zod_1.z.string().min(8, 'Phone number is required'),
    bank_account_number: zod_1.z.string().min(1, 'Bank account is required'),
    bank_name: zod_1.z.string().min(1, 'Bank name is required'),
    tax_code: zod_1.z.string().min(1, 'Tax code is required'),
    base_rate: zod_1.z.number().min(0).max(1).optional().default(0.8),
    min_payment: zod_1.z.number().min(0).optional().default(100),
    pub_code: zod_1.z.string().optional().nullable(),
});
exports.updateKOCSchema = zod_1.z.object({
    full_name: zod_1.z.string().min(2).optional(),
    channel_name: zod_1.z.string().min(1).optional(),
    youtube_channel_id: zod_1.z.string().min(1).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().min(8).optional(),
    bank_account_number: zod_1.z.string().min(1).optional(),
    bank_name: zod_1.z.string().min(1).optional(),
    tax_code: zod_1.z.string().min(1).optional(),
    base_rate: zod_1.z.number().min(0).max(1).optional(),
    min_payment: zod_1.z.number().min(0).optional(),
    pub_code: zod_1.z.string().optional().nullable(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
// ============================================================
// REVENUE CYCLE VALIDATION
// ============================================================
exports.createCycleSchema = zod_1.z.object({
    month: zod_1.z.string().regex(/^\d{2}\/\d{4}$/, 'Month must be in MM/YYYY format'),
    exchange_rate: zod_1.z.number().positive('Exchange rate must be positive'),
});
exports.updateCycleSchema = zod_1.z.object({
    exchange_rate: zod_1.z.number().positive().optional(),
    status: zod_1.z.enum(['OPEN', 'LOCKED', 'PAYMENT_COMPLETED']).optional(),
});
// ============================================================
// REVENUE RECORD VALIDATION
// ============================================================
exports.createRevenueRecordSchema = zod_1.z.object({
    koc_id: zod_1.z.string().uuid('Invalid KOC ID'),
    cycle_id: zod_1.z.number().int().positive('Invalid cycle ID'),
    original_revenue_usd: zod_1.z.number().min(0, 'Revenue must be non-negative'),
    us_tax_deduction: zod_1.z.number().min(0, 'Tax must be non-negative'),
});
exports.updateRevenueRecordSchema = zod_1.z.object({
    original_revenue_usd: zod_1.z.number().min(0).optional(),
    us_tax_deduction: zod_1.z.number().min(0).optional(),
});
exports.bulkCreateRevenueRecordSchema = zod_1.z.object({
    cycle_id: zod_1.z.number().int().positive(),
    records: zod_1.z.array(zod_1.z.object({
        koc_id: zod_1.z.string().uuid(),
        original_revenue_usd: zod_1.z.number().min(0),
        us_tax_deduction: zod_1.z.number().min(0),
    })),
});
// ============================================================
// PAGINATION VALIDATION
// ============================================================
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(20),
    search: zod_1.z.string().optional(),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
});
//# sourceMappingURL=validation.js.map