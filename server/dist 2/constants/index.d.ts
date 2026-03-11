/** Revenue calculation constants */
export declare const REVENUE_CONSTANTS: {
    /** Bank fee percentage: 0.25% */
    readonly BANK_FEE_RATE: 0.0025;
    /** Fixed bank fee in USD */
    readonly BANK_FEE_FIXED: 12;
    /** Default KOC base rate: 80% */
    readonly DEFAULT_KOC_BASE_RATE: 0.8;
    /** Company share rate: 20% */
    readonly COMPANY_SHARE_RATE: 0.2;
    /** KOC personal income tax rate: 10% */
    readonly KOC_TAX_RATE: 0.1;
    /** YouTube AdSense minimum payment threshold (USD) */
    readonly MIN_PAYMENT_THRESHOLD: 100;
};
/** Pagination defaults */
export declare const PAGINATION: {
    readonly DEFAULT_PAGE: 1;
    readonly DEFAULT_LIMIT: 20;
    readonly MAX_LIMIT: 100;
};
/** Audit log actions */
export declare const AUDIT_ACTIONS: {
    readonly CREATE_KOC: "CREATE_KOC";
    readonly UPDATE_KOC: "UPDATE_KOC";
    readonly DELETE_KOC: "DELETE_KOC";
    readonly CREATE_REVENUE_RECORD: "CREATE_REVENUE_RECORD";
    readonly UPDATE_REVENUE_RECORD: "UPDATE_REVENUE_RECORD";
    readonly DELETE_REVENUE_RECORD: "DELETE_REVENUE_RECORD";
    readonly APPROVE_REVENUE_RECORD: "APPROVE_REVENUE_RECORD";
    readonly CREATE_CYCLE: "CREATE_CYCLE";
    readonly UPDATE_CYCLE: "UPDATE_CYCLE";
    readonly LOCK_CYCLE: "LOCK_CYCLE";
    readonly REOPEN_CYCLE: "REOPEN_CYCLE";
    readonly COMPLETE_CYCLE: "COMPLETE_CYCLE";
    readonly SCRAPE_REVENUE: "SCRAPE_REVENUE";
    readonly RUN_CRON_JOB: "RUN_CRON_JOB";
    readonly UPDATE_CRON_CONFIG: "UPDATE_CRON_CONFIG";
    readonly UPDATE_EMAIL_CONFIG: "UPDATE_EMAIL_CONFIG";
    readonly SEND_REVENUE_EMAILS: "SEND_REVENUE_EMAILS";
    readonly LOGIN: "LOGIN";
};
/** Entity names for audit log */
export declare const ENTITIES: {
    readonly KOC: "KOC";
    readonly REVENUE_RECORD: "REVENUE_RECORD";
    readonly REVENUE_CYCLE: "REVENUE_CYCLE";
    readonly USER: "USER";
    readonly CHANNEL_STAT: "CHANNEL_STAT";
    readonly SYSTEM_CONFIG: "SYSTEM_CONFIG";
};
//# sourceMappingURL=index.d.ts.map