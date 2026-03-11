import { UserRole } from '@prisma/client';
import { Request } from 'express';
export interface JwtPayload {
    userId: string;
    email: string;
    role: UserRole;
    kocId?: string;
}
export interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
}
export interface ApiResponse<T = undefined> {
    success: boolean;
    message: string;
    data?: T;
    meta?: PaginationMeta;
}
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface PaginationQuery {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface RevenueCalculationInput {
    originalRevenueUsd: number;
    usTaxDeduction: number;
    baseRate: number;
    exchangeRate: number;
}
export interface RevenueCalculationResult {
    original_revenue_usd: number;
    us_tax_deduction: number;
    bank_fee: number;
    net_revenue: number;
    company_share: number;
    koc_share_gross: number;
    koc_tax_deduction: number;
    koc_receive_usd: number;
    koc_receive_vnd: number;
}
export interface SocialBladeStats {
    channelId: string;
    viewCount: number;
    subCount: number;
}
export interface SocialBladeApiResponse {
    data: {
        statistics: {
            totalViews: number;
            totalSubs: number;
        };
    };
}
export interface CreateKOCInput {
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
}
export interface UpdateKOCInput extends Partial<CreateKOCInput> {
    status?: 'ACTIVE' | 'INACTIVE';
}
export interface CreateCycleInput {
    month: string;
    exchange_rate: number;
}
export interface UpdateCycleInput {
    exchange_rate?: number;
    status?: 'OPEN' | 'LOCKED' | 'PAYMENT_COMPLETED';
}
export interface CreateRevenueRecordInput {
    koc_id: string;
    cycle_id: number;
    original_revenue_usd: number;
    us_tax_deduction: number;
}
export interface UpdateRevenueRecordInput {
    original_revenue_usd?: number;
    us_tax_deduction?: number;
}
export type { ChannelStats28dData, ColumnSpec, ColumnType, CountryStatsRow, CountryStatsTotals, DayStatsRow, DayStatsTotals, MonthlyRevenueData, MonthlyRevenueRow } from './stats.types';
//# sourceMappingURL=index.d.ts.map