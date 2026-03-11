export declare class DashboardService {
    /**
     * Get dashboard overview data (includes workflow info + growth summary)
     * If adminId is provided, scope all data to that admin's KOCs
     */
    static getOverview(adminId?: string): Promise<{
        totalKOCs: number;
        activeKOCs: number;
        totalCycles: number;
        latestCycleSummary: {
            cycle: {
                _count: {
                    revenue_records: number;
                };
            } & {
                status: import(".prisma/client").$Enums.CycleStatus;
                id: number;
                updated_at: Date;
                month: string;
                admin_id: string | null;
                exchange_rate: import("@prisma/client/runtime/library").Decimal;
                created_at: Date;
            };
            totalOriginal: number;
            totalNetRevenue: number;
            totalCompanyShare: number;
            totalKocReceiveUsd: number;
            totalKocReceiveVnd: number;
        } | null;
        recentRecords: ({
            koc: {
                full_name: string;
                channel_name: string;
            };
            cycle: {
                month: string;
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
        growthSummary: {
            koc_id: string;
            full_name: string;
            channel_name: string;
            views_growth: number;
            subs_growth: number;
            views_diff: number;
            subs_diff: number;
        }[];
        cyclesByStatus: Record<string, number>;
        pubCodeStats: {
            total: number;
            matched: number;
            mismatched: number;
            notChecked: number;
        };
        latestExchangeRate: number | null;
    }>;
    /**
     * Get revenue trend data (last N cycles)
     */
    static getRevenueTrend(limit?: number, adminId?: string): Promise<{
        month: string;
        totalRevenue: number;
        totalKocPay: number;
        totalCompanyShare: number;
        recordCount: number;
        revenueGrowth: number;
    }[]>;
}
//# sourceMappingURL=dashboard.service.d.ts.map