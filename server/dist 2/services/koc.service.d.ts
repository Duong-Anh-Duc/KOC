import { KOCStatus } from '@prisma/client';
import { PaginationQuery } from '../types';
interface KOCQuery extends PaginationQuery {
    adminId?: string;
}
export declare class KOCService {
    /**
     * Get all KOCs with pagination & search
     * If adminId is provided, only return KOCs managed by that admin
     */
    static getAll(query: KOCQuery): Promise<{
        data: {
            full_name: string;
            channel_name: string;
            youtube_channel_id: string;
            email: string;
            phone: string | null;
            bank_account_number: string | null;
            bank_name: string | null;
            tax_code: string | null;
            base_rate: import("@prisma/client/runtime/library").Decimal;
            min_payment: import("@prisma/client/runtime/library").Decimal;
            pub_code: string | null;
            status: import(".prisma/client").$Enums.KOCStatus;
            id: string;
            updated_at: Date;
            admin_id: string | null;
            created_at: Date;
        }[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Get KOC by ID (scoped to admin if adminId provided)
     */
    static getById(id: string, adminId?: string): Promise<{
        revenue_records: ({
            cycle: {
                month: string;
                exchange_rate: import("@prisma/client/runtime/library").Decimal;
            };
        } & {
            status: import(".prisma/client").$Enums.RecordStatus;
            id: string;
            updated_at: Date;
            created_at: Date;
            koc_id: string;
            cycle_id: number;
            original_revenue_usd: import("@prisma/client/runtime/library").Decimal;
            us_tax_deduction: import("@prisma/client/runtime/library").Decimal;
            bank_fee: import("@prisma/client/runtime/library").Decimal;
            net_revenue: import("@prisma/client/runtime/library").Decimal;
            company_share: import("@prisma/client/runtime/library").Decimal;
            koc_share_gross: import("@prisma/client/runtime/library").Decimal;
            koc_tax_deduction: import("@prisma/client/runtime/library").Decimal;
            koc_receive_usd: import("@prisma/client/runtime/library").Decimal;
            koc_receive_vnd: import("@prisma/client/runtime/library").Decimal;
            accumulated_revenue_usd: import("@prisma/client/runtime/library").Decimal;
            accumulated_koc_usd: import("@prisma/client/runtime/library").Decimal;
            paid_in_cycle_id: number | null;
            scraped_pub_code: string | null;
            pub_code_match: boolean | null;
        })[];
        channel_stats: {
            id: string;
            koc_id: string;
            recorded_at: Date;
            view_count: bigint;
            sub_count: bigint;
            yt_analytics: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        full_name: string;
        channel_name: string;
        youtube_channel_id: string;
        email: string;
        phone: string | null;
        bank_account_number: string | null;
        bank_name: string | null;
        tax_code: string | null;
        base_rate: import("@prisma/client/runtime/library").Decimal;
        min_payment: import("@prisma/client/runtime/library").Decimal;
        pub_code: string | null;
        status: import(".prisma/client").$Enums.KOCStatus;
        id: string;
        updated_at: Date;
        admin_id: string | null;
        created_at: Date;
    }>;
    /**
     * Create a new KOC
     */
    static create(data: {
        full_name: string;
        channel_name: string;
        youtube_channel_id: string;
        email: string;
        phone: string;
        bank_account_number: string;
        bank_name: string;
        tax_code: string;
        base_rate?: number;
        min_payment?: number;
        pub_code?: string;
        admin_id?: string;
    }): Promise<{
        full_name: string;
        channel_name: string;
        youtube_channel_id: string;
        email: string;
        phone: string | null;
        bank_account_number: string | null;
        bank_name: string | null;
        tax_code: string | null;
        base_rate: import("@prisma/client/runtime/library").Decimal;
        min_payment: import("@prisma/client/runtime/library").Decimal;
        pub_code: string | null;
        status: import(".prisma/client").$Enums.KOCStatus;
        id: string;
        updated_at: Date;
        admin_id: string | null;
        created_at: Date;
    }>;
    /**
     * Update a KOC
     */
    static update(id: string, data: Partial<{
        admin_id: string;
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
        pub_code: string;
        status: KOCStatus;
    }>): Promise<{
        koc: {
            full_name: string;
            channel_name: string;
            youtube_channel_id: string;
            email: string;
            phone: string | null;
            bank_account_number: string | null;
            bank_name: string | null;
            tax_code: string | null;
            base_rate: import("@prisma/client/runtime/library").Decimal;
            min_payment: import("@prisma/client/runtime/library").Decimal;
            pub_code: string | null;
            status: import(".prisma/client").$Enums.KOCStatus;
            id: string;
            updated_at: Date;
            admin_id: string | null;
            created_at: Date;
        };
        oldValue: {
            full_name: string;
            channel_name: string;
            youtube_channel_id: string;
            email: string;
            phone: string | null;
            bank_account_number: string | null;
            bank_name: string | null;
            tax_code: string | null;
            base_rate: import("@prisma/client/runtime/library").Decimal;
            min_payment: import("@prisma/client/runtime/library").Decimal;
            pub_code: string | null;
            status: import(".prisma/client").$Enums.KOCStatus;
            id: string;
            updated_at: Date;
            admin_id: string | null;
            created_at: Date;
        };
    }>;
    /**
     * Delete a KOC (soft delete by setting INACTIVE, or hard delete)
     */
    static delete(id: string, adminId?: string): Promise<{
        full_name: string;
        channel_name: string;
        youtube_channel_id: string;
        email: string;
        phone: string | null;
        bank_account_number: string | null;
        bank_name: string | null;
        tax_code: string | null;
        base_rate: import("@prisma/client/runtime/library").Decimal;
        min_payment: import("@prisma/client/runtime/library").Decimal;
        pub_code: string | null;
        status: import(".prisma/client").$Enums.KOCStatus;
        id: string;
        updated_at: Date;
        admin_id: string | null;
        created_at: Date;
    }>;
    /**
     * Get all active KOCs (for dropdowns/selects)
     * If adminId is provided, only return KOCs managed by that admin
     */
    static getActiveKOCs(adminId?: string): Promise<{
        full_name: string;
        channel_name: string;
        base_rate: import("@prisma/client/runtime/library").Decimal;
        id: string;
        admin_id: string | null;
    }[]>;
}
export {};
//# sourceMappingURL=koc.service.d.ts.map