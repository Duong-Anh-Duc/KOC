import { z } from 'zod';

// ============================================================
// AUTH VALIDATION
// ============================================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Full name is required'),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'KOC']).optional(),
});

export const createKocAccountSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ============================================================
// KOC VALIDATION
// ============================================================

export const createKOCSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  channel_name: z.string().min(1, 'Channel name is required'),
  youtube_channel_id: z.string().min(1, 'YouTube channel ID is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(8, 'Phone number is required'),
  bank_account_number: z.string().min(1, 'Bank account is required'),
  bank_name: z.string().min(1, 'Bank name is required'),
  tax_code: z.string().min(1, 'Tax code is required'),
  base_rate: z.number().min(0).max(1).optional().default(0.8),
  pub_code: z.string().optional().nullable(),
});

export const updateKOCSchema = z.object({
  full_name: z.string().min(2).optional(),
  channel_name: z.string().min(1).optional(),
  youtube_channel_id: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  bank_account_number: z.string().min(1).optional(),
  bank_name: z.string().min(1).optional(),
  tax_code: z.string().min(1).optional(),
  base_rate: z.number().min(0).max(1).optional(),
  pub_code: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

// ============================================================
// REVENUE CYCLE VALIDATION
// ============================================================

export const createCycleSchema = z.object({
  month: z.string().regex(/^\d{2}\/\d{4}$/, 'Month must be in MM/YYYY format'),
  exchange_rate: z.number().positive('Exchange rate must be positive'),
});

export const updateCycleSchema = z.object({
  exchange_rate: z.number().positive().optional(),
  status: z.enum(['OPEN', 'LOCKED', 'PAYMENT_COMPLETED']).optional(),
});

// ============================================================
// REVENUE RECORD VALIDATION
// ============================================================

export const createRevenueRecordSchema = z.object({
  koc_id: z.string().uuid('Invalid KOC ID'),
  cycle_id: z.number().int().positive('Invalid cycle ID'),
  original_revenue_usd: z.number().min(0, 'Revenue must be non-negative'),
  us_tax_deduction: z.number().min(0, 'Tax must be non-negative'),
});

export const updateRevenueRecordSchema = z.object({
  original_revenue_usd: z.number().min(0).optional(),
  us_tax_deduction: z.number().min(0).optional(),
});

export const bulkCreateRevenueRecordSchema = z.object({
  cycle_id: z.number().int().positive(),
  records: z.array(
    z.object({
      koc_id: z.string().uuid(),
      original_revenue_usd: z.number().min(0),
      us_tax_deduction: z.number().min(0),
    })
  ),
});

// ============================================================
// PAGINATION VALIDATION
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateKocAccountInput = z.infer<typeof createKocAccountSchema>;
export type CreateKOCInput = z.infer<typeof createKOCSchema>;
export type UpdateKOCInput = z.infer<typeof updateKOCSchema>;
export type CreateCycleInput = z.infer<typeof createCycleSchema>;
export type UpdateCycleInput = z.infer<typeof updateCycleSchema>;
export type CreateRevenueRecordInput = z.infer<typeof createRevenueRecordSchema>;
export type UpdateRevenueRecordInput = z.infer<typeof updateRevenueRecordSchema>;
export type BulkCreateRevenueRecordInput = z.infer<typeof bulkCreateRevenueRecordSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
