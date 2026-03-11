import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    full_name: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["ADMIN", "ACCOUNTANT", "KOC"]>>;
}, "strip", z.ZodTypeAny, {
    full_name: string;
    email: string;
    password: string;
    role?: "ADMIN" | "ACCOUNTANT" | "KOC" | undefined;
}, {
    full_name: string;
    email: string;
    password: string;
    role?: "ADMIN" | "ACCOUNTANT" | "KOC" | undefined;
}>;
export declare const createKocAccountSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const createKOCSchema: z.ZodObject<{
    full_name: z.ZodString;
    channel_name: z.ZodString;
    youtube_channel_id: z.ZodString;
    email: z.ZodString;
    phone: z.ZodString;
    bank_account_number: z.ZodString;
    bank_name: z.ZodString;
    tax_code: z.ZodString;
    base_rate: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    min_payment: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pub_code: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    full_name: string;
    channel_name: string;
    youtube_channel_id: string;
    email: string;
    phone: string;
    bank_account_number: string;
    bank_name: string;
    tax_code: string;
    base_rate: number;
    min_payment: number;
    pub_code?: string | null | undefined;
}, {
    full_name: string;
    channel_name: string;
    youtube_channel_id: string;
    email: string;
    phone: string;
    bank_account_number: string;
    bank_name: string;
    tax_code: string;
    base_rate?: number | undefined;
    min_payment?: number | undefined;
    pub_code?: string | null | undefined;
}>;
export declare const updateKOCSchema: z.ZodObject<{
    full_name: z.ZodOptional<z.ZodString>;
    channel_name: z.ZodOptional<z.ZodString>;
    youtube_channel_id: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    bank_account_number: z.ZodOptional<z.ZodString>;
    bank_name: z.ZodOptional<z.ZodString>;
    tax_code: z.ZodOptional<z.ZodString>;
    base_rate: z.ZodOptional<z.ZodNumber>;
    min_payment: z.ZodOptional<z.ZodNumber>;
    pub_code: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["ACTIVE", "INACTIVE"]>>;
}, "strip", z.ZodTypeAny, {
    full_name?: string | undefined;
    channel_name?: string | undefined;
    youtube_channel_id?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    bank_account_number?: string | undefined;
    bank_name?: string | undefined;
    tax_code?: string | undefined;
    base_rate?: number | undefined;
    min_payment?: number | undefined;
    pub_code?: string | null | undefined;
    status?: "ACTIVE" | "INACTIVE" | undefined;
}, {
    full_name?: string | undefined;
    channel_name?: string | undefined;
    youtube_channel_id?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    bank_account_number?: string | undefined;
    bank_name?: string | undefined;
    tax_code?: string | undefined;
    base_rate?: number | undefined;
    min_payment?: number | undefined;
    pub_code?: string | null | undefined;
    status?: "ACTIVE" | "INACTIVE" | undefined;
}>;
export declare const createCycleSchema: z.ZodObject<{
    month: z.ZodString;
    exchange_rate: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    month: string;
    exchange_rate: number;
}, {
    month: string;
    exchange_rate: number;
}>;
export declare const updateCycleSchema: z.ZodObject<{
    exchange_rate: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<["OPEN", "LOCKED", "PAYMENT_COMPLETED"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "OPEN" | "LOCKED" | "PAYMENT_COMPLETED" | undefined;
    exchange_rate?: number | undefined;
}, {
    status?: "OPEN" | "LOCKED" | "PAYMENT_COMPLETED" | undefined;
    exchange_rate?: number | undefined;
}>;
export declare const createRevenueRecordSchema: z.ZodObject<{
    koc_id: z.ZodString;
    cycle_id: z.ZodNumber;
    original_revenue_usd: z.ZodNumber;
    us_tax_deduction: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    koc_id: string;
    cycle_id: number;
    original_revenue_usd: number;
    us_tax_deduction: number;
}, {
    koc_id: string;
    cycle_id: number;
    original_revenue_usd: number;
    us_tax_deduction: number;
}>;
export declare const updateRevenueRecordSchema: z.ZodObject<{
    original_revenue_usd: z.ZodOptional<z.ZodNumber>;
    us_tax_deduction: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    original_revenue_usd?: number | undefined;
    us_tax_deduction?: number | undefined;
}, {
    original_revenue_usd?: number | undefined;
    us_tax_deduction?: number | undefined;
}>;
export declare const bulkCreateRevenueRecordSchema: z.ZodObject<{
    cycle_id: z.ZodNumber;
    records: z.ZodArray<z.ZodObject<{
        koc_id: z.ZodString;
        original_revenue_usd: z.ZodNumber;
        us_tax_deduction: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        koc_id: string;
        original_revenue_usd: number;
        us_tax_deduction: number;
    }, {
        koc_id: string;
        original_revenue_usd: number;
        us_tax_deduction: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    cycle_id: number;
    records: {
        koc_id: string;
        original_revenue_usd: number;
        us_tax_deduction: number;
    }[];
}, {
    cycle_id: number;
    records: {
        koc_id: string;
        original_revenue_usd: number;
        us_tax_deduction: number;
    }[];
}>;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    search: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    sortOrder: "asc" | "desc";
    search?: string | undefined;
    sortBy?: string | undefined;
}, {
    search?: string | undefined;
    limit?: number | undefined;
    page?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
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
//# sourceMappingURL=validation.d.ts.map