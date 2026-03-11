export interface CronConfig {
    enabled: boolean;
    /** Cron expression (e.g. "0 3 1 * *" = 3:00 AM on the 1st of every month) */
    schedule: string;
    /** Auto-create cycle for previous month */
    autoCreateCycle: boolean;
    /** Auto-scrape YouTube revenue after creating cycle */
    autoScrapeRevenue: boolean;
    /** Last run timestamp */
    lastRunAt?: string;
    /** Last run result */
    lastRunResult?: string;
    /** Run history (last 10 runs) */
    runHistory?: Array<{
        runAt: string;
        success: boolean;
        message: string;
        cycleMonth?: string;
    }>;
}
export declare class CronService {
    /**
     * Get current cron configuration
     */
    static getConfig(adminId?: string): Promise<CronConfig>;
    /**
     * Update cron configuration
     */
    static updateConfig(newConfig: Partial<CronConfig>, adminId?: string): Promise<CronConfig>;
    /**
     * Get previous month string in MM/YYYY format
     */
    static getPreviousMonth(referenceDate?: Date): string;
    /**
     * Get the next cycle month that should be created.
     * Looks at existing cycles and finds the next month that:
     * 1. Doesn't have a cycle yet
     * 2. Has already completed (is in the past)
     * Returns { targetMonth, canRun, reason }
     */
    static getNextCycleMonth(): Promise<{
        targetMonth: string;
        canRun: boolean;
        reason?: string;
    }>;
    /**
     * Run the cron job manually or automatically:
     * 1. Create cycle for the next uncreated month (must be completed)
     * 2. Fetch exchange rate
     * 3. Scrape YouTube revenue and create records
     * 4. Scrape monthly revenue analytics for cross-reference
     */
    static runJob(adminId?: string): Promise<{
        success: boolean;
        message: string;
        cycleMonth?: string;
    }>;
    /**
     * Add a run to the history (keep last 20)
     */
    private static addRunHistory;
    /**
     * Start the cron scheduler
     */
    static startScheduler(adminId?: string): Promise<void>;
    /**
     * Start schedulers for all admins that have a saved cron config
     */
    static startAllSchedulers(): Promise<void>;
    /**
     * Stop the cron scheduler for a specific admin (or all)
     */
    static stopScheduler(adminId?: string): void;
    /**
     * Restart the scheduler (e.g., after config change)
     */
    static restartScheduler(adminId?: string): Promise<void>;
    /**
     * Get scheduler status for a specific admin
     */
    static getSchedulerStatus(adminId?: string): {
        running: boolean;
    };
}
//# sourceMappingURL=cron.service.d.ts.map