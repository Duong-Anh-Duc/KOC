// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta?: PaginationMeta;
}

// ============================================================
// AUTH TYPES
// ============================================================

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthUser {
  userId: string;
  email: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'KOC';
  full_name: string;
  kocId?: string;
}

// ============================================================
// KOC TYPES
// ============================================================

export interface KOC {
  id: string;
  full_name: string;
  channel_name: string;
  youtube_channel_id: string;
  email: string;
  phone: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  tax_code: string | null;
  base_rate: number;
  min_payment: number;
  pub_code: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  revenue_records?: RevenueRecord[];
  channel_stats?: ChannelStat[];
}

export interface CreateKOCInput {
  full_name: string;
  channel_name: string;
  youtube_channel_id: string;
  email: string;
  phone?: string;
  bank_account_number?: string;
  bank_name?: string;
  tax_code?: string;
  base_rate?: number;
  min_payment?: number;
  pub_code?: string;
}

export interface UpdateKOCInput extends Partial<CreateKOCInput> {
  status?: 'ACTIVE' | 'INACTIVE';
}

// ============================================================
// REVENUE CYCLE TYPES
// ============================================================

export interface RevenueCycle {
  id: number;
  month: string;
  status: 'OPEN' | 'LOCKED' | 'PAYMENT_COMPLETED';
  exchange_rate: number;
  created_at: string;
  updated_at: string;
  _count?: { revenue_records: number };
  revenue_records?: RevenueRecord[];
}

export interface CreateCycleInput {
  month: string;
  exchange_rate: number;
}

export interface UpdateCycleInput {
  exchange_rate?: number;
  status?: 'OPEN' | 'LOCKED' | 'PAYMENT_COMPLETED';
}

// ============================================================
// REVENUE RECORD TYPES
// ============================================================

export interface RevenueRecord {
  id: string;
  koc_id: string;
  cycle_id: number;
  original_revenue_usd: number;
  us_tax_deduction: number;
  bank_fee: number;
  net_revenue: number;
  company_share: number;
  koc_share_gross: number;
  koc_tax_deduction: number;
  koc_receive_usd: number;
  koc_receive_vnd: number;
  scraped_pub_code: string | null;
  pub_code_match: boolean | null;
  status: 'PENDING' | 'APPROVED';
  created_at: string;
  updated_at: string;
  koc?: { full_name: string; channel_name: string; bank_name?: string; bank_account_number?: string; pub_code?: string | null };
  cycle?: { month: string; exchange_rate: number; status?: string };
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

export interface BulkCreateRevenueRecordInput {
  cycle_id: number;
  records: Array<{
    koc_id: string;
    original_revenue_usd: number;
    us_tax_deduction: number;
  }>;
}

// ============================================================
// CHANNEL STATS TYPES
// ============================================================

export interface ChannelStat {
  id: string;
  koc_id: string;
  view_count: number;
  sub_count: number;
  recorded_at: string;
}

// ============================================================
// DASHBOARD TYPES
// ============================================================

export interface DashboardOverview {
  totalKOCs: number;
  activeKOCs: number;
  totalCycles: number;
  latestCycleSummary: {
    cycle: RevenueCycle;
    totalOriginal: number;
    totalNetRevenue: number;
    totalCompanyShare: number;
    totalKocReceiveUsd: number;
    totalKocReceiveVnd: number;
  } | null;
  recentRecords: RevenueRecord[];
  growthSummary: Array<{
    koc_id: string;
    full_name: string;
    channel_name: string;
    views_growth: number;
    subs_growth: number;
    views_diff: number;
    subs_diff: number;
    latest_views: number;
    latest_subs: number;
  }>;
}

export interface RevenueTrend {
  month: string;
  totalRevenue: number;
  totalKocPay: number;
  totalCompanyShare: number;
  recordCount: number;
  revenueGrowth: number;
}

// ============================================================
// AUDIT LOG TYPES
// ============================================================

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  timestamp: string;
  user?: { full_name: string; email: string };
}

// ============================================================
// YOUTUBE SCRAPER TYPES
// ============================================================

export interface RevenueByCountry {
  country: string;
  estimatedRevenue: number | null;
  revenuePercent: number | null;
  views: number | null;
  viewsPercent: number | null;
  watchTimeHours: number | null;
  watchTimePercent: number | null;
  avgWatchTime: string | null;
}

export interface YouTubeAnalyticsData {
  channelId: string;
  totals: {
    estimatedRevenue: number | null;
    views: number | null;
    watchTimeHours: number | null;
    avgWatchTime: string | null;
  };
  countries: RevenueByCountry[];
  period: string;
  rawText?: string;
  scrapedAt: string;
}

// ============================================================
// YOUTUBE SCRAPE RESULT TYPES (from DB)
// ============================================================

export interface YouTubeScrapeResult {
  id: string;
  koc_id: string;
  channel_id: string;
  views: number | null;
  watch_time_hours: number | null;
  estimated_revenue: number | null;
  avg_watch_time: string | null;
  period: string | null;
  country_data: RevenueByCountry[] | null;
  raw_texts: { revenue_explore: string } | null;
  scraped_at: string;
  // Joined KOC info (for latest results)
  full_name?: string;
  channel_name?: string;
  youtube_channel_id?: string;
  koc_status?: string;
  // Included relation (for history)
  koc?: { full_name: string; channel_name: string };
}

// ============================================================
// MONTHLY REVENUE ANALYTICS
// ============================================================
export interface MonthlyRevenueAnalytics {
  id: string;
  koc_id: string;
  channel_id: string;
  month_label: string;
  month_key: string;
  views: number | null;
  views_percent: number | null;
  watch_time_hours: number | null;
  watch_time_percent: number | null;
  avg_watch_time: string | null;
  estimated_revenue: number | null;
  revenue_percent: number | null;
  scraped_at: string;
  koc?: { full_name: string; channel_name: string; youtube_channel_id: string };
}

// ============================================================
// PROGRESS / SSE TYPES
// ============================================================

export interface ProgressEvent {
  step: number;
  total: number;
  percent: number;
  message: string;
}

export interface PaymentStatusEntry {
  accumulated: number;
  belowThreshold: boolean;
  accumulatedMonths: Array<{ month: string; revenue: number }>;
  threshold: number;
}

export type PaymentStatusMap = Record<string, PaymentStatusEntry>;
