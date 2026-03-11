import { RevenueCalculationInput, RevenueCalculationResult } from '../types';
export declare class RevenueService {
    /**
     * Core revenue calculation formula
     *
     * 1. Bank Fee = ((Original - US_Tax) * 0.25%) + $12
     * 2. Net Revenue = Original - US_Tax - Bank_Fee
     * 3. Company Share = Net * (1 - base_rate)
     * 4. KOC Gross = Net * base_rate (default 80%)
     * 5. KOC Tax = KOC_Gross * 10%
     * 6. Final USD = KOC_Gross - KOC_Tax
     * 7. Final VND = Final_USD * Exchange_Rate
     */
    static calculate(input: RevenueCalculationInput): RevenueCalculationResult;
    /**
     * Create a revenue record for a KOC in a specific cycle
     */
    static createRecord(kocId: string, cycleId: number, originalRevenueUsd: number, usTaxDeduction: number, adminId?: string): Promise<{
        koc: {
            full_name: string;
            channel_name: string;
            pub_code: string | null;
        };
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
    }>;
    /**
     * Update a revenue record (recalculates all derived fields)
     */
    static updateRecord(recordId: string, originalRevenueUsd?: number, usTaxDeduction?: number, adminId?: string): Promise<{
        record: {
            koc: {
                full_name: string;
                channel_name: string;
                pub_code: string | null;
            };
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
        };
        oldValue: {
            original_revenue_usd: number;
            us_tax_deduction: number;
            koc_receive_usd: number;
            koc_receive_vnd: number;
        };
    }>;
    /**
     * Bulk create revenue records for a cycle
     */
    static bulkCreateRecords(cycleId: number, records: Array<{
        koc_id: string;
        original_revenue_usd: number;
        us_tax_deduction: number;
    }>, adminId?: string): Promise<{
        record: {
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
        };
        isNew: boolean;
        oldValue: {
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
        } | null;
    }[]>;
    /**
     * Get all records for a specific cycle
     * @param statusFilter - Optional filter: 'APPROVED' | 'PENDING' to get only records with that status
     */
    static getRecordsByCycle(cycleId: number, statusFilter?: 'APPROVED' | 'PENDING', adminId?: string): Promise<{
        records: {
            accumulated_revenue_usd: number;
            accumulated_us_tax: number;
            accumulated_bank_fee: number;
            accumulated_net_revenue: number;
            accumulated_company_share: number;
            accumulated_koc_gross: number;
            accumulated_koc_tax: number;
            accumulated_koc_usd: number;
            accumulated_koc_vnd: number;
            koc: {
                full_name: string;
                channel_name: string;
                bank_account_number: string | null;
                bank_name: string | null;
                base_rate: import("@prisma/client/runtime/library").Decimal;
            };
            cycle: {
                status: import(".prisma/client").$Enums.CycleStatus;
                month: string;
                exchange_rate: import("@prisma/client/runtime/library").Decimal;
            };
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
            paid_in_cycle_id: number | null;
            scraped_pub_code: string | null;
            pub_code_match: boolean | null;
        }[];
        totals: {
            totalOriginal: number;
            totalNetRevenue: number;
            totalCompanyShare: number;
            totalKocReceiveUsd: number;
            totalKocReceiveVnd: number;
            totalAccumulatedKocUsd: number;
            totalAccumulatedKocVnd: number;
        };
    }>;
    /**
     * Get revenue record by ID
     */
    static getRecordById(recordId: string): Promise<{
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
        cycle: {
            status: import(".prisma/client").$Enums.CycleStatus;
            id: number;
            updated_at: Date;
            month: string;
            admin_id: string | null;
            exchange_rate: import("@prisma/client/runtime/library").Decimal;
            created_at: Date;
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
    }>;
    /**
     * Delete a revenue record
     */
    static deleteRecord(recordId: string): Promise<{
        cycle: {
            status: import(".prisma/client").$Enums.CycleStatus;
            id: number;
            updated_at: Date;
            month: string;
            admin_id: string | null;
            exchange_rate: import("@prisma/client/runtime/library").Decimal;
            created_at: Date;
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
    }>;
    /**
     * Bulk delete revenue records by IDs (all must belong to OPEN cycles)
     */
    static bulkDeleteRecords(ids: string[]): Promise<{
        deleted: number;
    }>;
    /**
     * Approve a revenue record.
     * Approves this record AND all previous PENDING records for the same KOC
     * (since threshold was accumulated across months). paid_in_cycle_id is set
     * to the current record's cycle_id to mark where payment was finalized.
     */
    static approveRecord(recordId: string): Promise<{
        status: "APPROVED";
        paid_in_cycle_id: number;
        cycle: {
            status: import(".prisma/client").$Enums.CycleStatus;
            id: number;
            updated_at: Date;
            month: string;
            admin_id: string | null;
            exchange_rate: import("@prisma/client/runtime/library").Decimal;
            created_at: Date;
        };
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
        scraped_pub_code: string | null;
        pub_code_match: boolean | null;
    }>;
    /**
     * Get payment status for each record in a cycle.
     * Uses per-KOC min_payment threshold. Accumulates original_revenue_usd across months.
     * When a cycle is PAYMENT_COMPLETED, records in that cycle are considered paid → reset accumulation.
     * Returns map of koc_id -> { accumulated, belowThreshold, accumulatedMonths, threshold }
     */
    static getPaymentStatus(cycleId: number, adminId?: string): Promise<Record<string, {
        accumulated: number;
        belowThreshold: boolean;
        accumulatedMonths: Array<{
            month: string;
            revenue: number;
        }>;
        threshold: number;
    }>>;
    /** Round to 2 decimal places */
    private static round2;
}
//# sourceMappingURL=revenue.service.d.ts.map