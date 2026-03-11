"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = __importDefault(require("../config/database"));
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
const cycle_service_1 = require("./cycle.service");
const email_service_1 = require("./email.service");
const exchange_rate_service_1 = require("./exchange-rate.service");
const monthly_revenue_service_1 = require("./monthly-revenue.service");
const revenue_service_1 = require("./revenue.service");
const youtube_scrape_result_service_1 = require("./youtube-scrape-result.service");
const youtube_scraper_service_1 = require("./youtube-scraper.service");
const CRON_CONFIG_KEY_PREFIX = 'cron_auto_cycle';
function getConfigKey(adminId) {
    return adminId ? `${CRON_CONFIG_KEY_PREFIX}_${adminId}` : CRON_CONFIG_KEY_PREFIX;
}
const DEFAULT_CONFIG = {
    enabled: false,
    schedule: '0 3 1 * *', // 3:00 AM on the 1st of every month
    autoCreateCycle: true,
    autoScrapeRevenue: true,
    runHistory: [],
};
const scheduledTasks = new Map();
class CronService {
    /**
     * Get current cron configuration
     */
    static async getConfig(adminId) {
        const config = await database_1.default.systemConfig.findUnique({
            where: { key: getConfigKey(adminId) },
        });
        if (!config) {
            return { ...DEFAULT_CONFIG };
        }
        return config.value;
    }
    /**
     * Update cron configuration
     */
    static async updateConfig(newConfig, adminId) {
        const current = await this.getConfig(adminId);
        const merged = { ...current, ...newConfig };
        const key = getConfigKey(adminId);
        await database_1.default.systemConfig.upsert({
            where: { key },
            update: { value: merged },
            create: { key, value: merged },
        });
        // Restart this admin's scheduler with new config
        await this.restartScheduler(adminId);
        return merged;
    }
    /**
     * Get previous month string in MM/YYYY format
     */
    static getPreviousMonth(referenceDate) {
        const now = referenceDate || new Date();
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const mm = String(prevMonth.getMonth() + 1).padStart(2, '0');
        const yyyy = prevMonth.getFullYear();
        return `${mm}/${yyyy}`;
    }
    /**
     * Get the next cycle month that should be created.
     * Looks at existing cycles and finds the next month that:
     * 1. Doesn't have a cycle yet
     * 2. Has already completed (is in the past)
     * Returns { targetMonth, canRun, reason }
     */
    static async getNextCycleMonth() {
        const now = new Date();
        const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        // Get the latest cycle by month
        const latestCycle = await database_1.default.revenueCycle.findFirst({
            orderBy: { month: 'desc' },
        });
        let targetMonth;
        if (!latestCycle) {
            // No cycles exist, target previous month
            targetMonth = this.getPreviousMonth();
        }
        else {
            // Parse the latest cycle month and compute the next one
            const [mm, yyyy] = latestCycle.month.split('/');
            const latestDate = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);
            const nextDate = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 1);
            const nextMM = String(nextDate.getMonth() + 1).padStart(2, '0');
            const nextYYYY = nextDate.getFullYear();
            targetMonth = `${nextMM}/${nextYYYY}`;
        }
        // Check if target month is current or future month
        const [targetMM, targetYYYY] = targetMonth.split('/');
        const targetDate = new Date(parseInt(targetYYYY), parseInt(targetMM) - 1, 1);
        const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
        if (targetDate >= currentMonthDate) {
            return {
                targetMonth,
                canRun: false,
                reason: targetMonth === currentMonth
                    ? `MONTH_NOT_COMPLETED`
                    : `MONTH_IN_FUTURE`,
            };
        }
        return { targetMonth, canRun: true };
    }
    /**
     * Run the cron job manually or automatically:
     * 1. Create cycle for the next uncreated month (must be completed)
     * 2. Fetch exchange rate
     * 3. Scrape YouTube revenue and create records
     * 4. Scrape monthly revenue analytics for cross-reference
     */
    static async runJob(adminId) {
        const config = await this.getConfig(adminId);
        // Calculate the actual next cycle month
        const { targetMonth: nextMonth, canRun, reason } = await this.getNextCycleMonth();
        if (!canRun) {
            const msg = reason === 'MONTH_NOT_COMPLETED'
                ? `Cannot create cycle for ${nextMonth}: the month has not ended yet`
                : `Cannot create cycle for ${nextMonth}: the month is in the future`;
            logger_middleware_1.default.warn(`[CronJob] ${msg}`);
            await this.addRunHistory(false, msg, nextMonth, adminId);
            return { success: false, message: msg, cycleMonth: nextMonth };
        }
        const previousMonth = nextMonth;
        logger_middleware_1.default.info(`[CronJob] Starting auto-cycle job for month: ${previousMonth}`);
        try {
            // Step 1: Check if cycle already exists
            const existingCycles = await database_1.default.revenueCycle.findMany({
                where: { month: previousMonth },
            });
            let cycleId;
            let cycleCreated = false;
            if (existingCycles.length > 0) {
                cycleId = existingCycles[0].id;
                logger_middleware_1.default.info(`[CronJob] Cycle for ${previousMonth} already exists (ID: ${cycleId})`);
            }
            else if (config.autoCreateCycle) {
                // Fetch exchange rate
                let exchangeRate = 25000; // fallback
                try {
                    const rateData = await exchange_rate_service_1.ExchangeRateService.fetchRate();
                    exchangeRate = rateData.averageRate || 25000;
                    logger_middleware_1.default.info(`[CronJob] Fetched exchange rate: ${exchangeRate}`);
                }
                catch (err) {
                    logger_middleware_1.default.warn(`[CronJob] Failed to fetch exchange rate, using default: ${exchangeRate}`);
                }
                // Create cycle
                const cycle = await cycle_service_1.CycleService.create(previousMonth, exchangeRate);
                cycleId = cycle.id;
                cycleCreated = true;
                logger_middleware_1.default.info(`[CronJob] Created cycle for ${previousMonth} (ID: ${cycleId})`);
            }
            else {
                const msg = `Cycle for ${previousMonth} does not exist and autoCreateCycle is disabled`;
                logger_middleware_1.default.warn(`[CronJob] ${msg}`);
                await this.addRunHistory(false, msg, previousMonth, adminId);
                return { success: false, message: msg, cycleMonth: previousMonth };
            }
            // Step 2: Auto-scrape YouTube revenue
            if (config.autoScrapeRevenue) {
                try {
                    const cycle = await cycle_service_1.CycleService.getById(cycleId);
                    if (cycle.status !== 'OPEN') {
                        const msg = `Cycle ${previousMonth} is not OPEN (status: ${cycle.status}), skipping scrape`;
                        logger_middleware_1.default.warn(`[CronJob] ${msg}`);
                        await this.addRunHistory(true, cycleCreated ? `Cycle created. ${msg}` : msg, previousMonth, adminId);
                        return { success: true, message: msg, cycleMonth: previousMonth };
                    }
                    // Find a valid YouTube session — prefer the current admin's session
                    const sessionWhere = adminId
                        ? { admin_id: adminId, is_logged_in: true }
                        : { is_logged_in: true, admin: { role: 'ADMIN', is_active: true } };
                    const adminSession = await database_1.default.youTubeSession.findFirst({
                        where: sessionWhere,
                        select: { admin_id: true }
                    });
                    if (!adminSession) {
                        const msg = `No admin with valid YouTube session found. Please login to YouTube Studio first.`;
                        logger_middleware_1.default.warn(`[CronJob] ${msg}`);
                        await this.addRunHistory(false, cycleCreated ? `Cycle created. ${msg}` : msg, previousMonth, adminId);
                        return { success: false, message: msg, cycleMonth: previousMonth };
                    }
                    const effectiveAdminId = adminSession.admin_id;
                    logger_middleware_1.default.info(`[CronJob] Using admin ${effectiveAdminId} for scraping`);
                    // Get active KOCs scoped to this admin
                    const kocs = await database_1.default.kOC.findMany({
                        where: { status: 'ACTIVE', ...(adminId ? { admin_id: adminId } : {}) },
                        select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true, base_rate: true },
                    });
                    if (kocs.length === 0) {
                        const msg = `No active KOCs found for scraping`;
                        logger_middleware_1.default.warn(`[CronJob] ${msg}`);
                        await this.addRunHistory(true, cycleCreated ? `Cycle created. ${msg}` : msg, previousMonth, adminId);
                        return { success: true, message: msg, cycleMonth: previousMonth };
                    }
                    // Scrape all channels (with admin's Chrome profile)
                    const channelIds = kocs
                        .map(k => youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(k.youtube_channel_id))
                        .filter(id => id && id.length > 0);
                    const { results: scrapeResults, errors: scrapeErrors } = await youtube_scraper_service_1.YouTubeScraperService.scrapeMultipleChannels(channelIds, undefined, undefined, effectiveAdminId);
                    // Map channels to KOCs
                    const channelToKocMap = new Map();
                    for (const koc of kocs) {
                        if (koc.youtube_channel_id) {
                            channelToKocMap.set(youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(koc.youtube_channel_id), koc);
                        }
                    }
                    // Save scrape results
                    for (const result of scrapeResults) {
                        const koc = channelToKocMap.get(result.channelId);
                        if (koc) {
                            await youtube_scrape_result_service_1.YouTubeScrapeResultService.saveResult(koc.id, koc.youtube_channel_id, result);
                        }
                    }
                    // Create revenue records
                    const US_TAX_RATE = 0.30;
                    const US_COUNTRY_NAMES = ['hoa kỳ', 'united states', 'us', 'usa', 'états-unis'];
                    let recordsCreated = 0;
                    let recordsSkipped = 0;
                    for (const result of scrapeResults) {
                        const koc = channelToKocMap.get(result.channelId);
                        if (!koc)
                            continue;
                        const revenue = result.totals.estimatedRevenue;
                        if (revenue == null || revenue <= 0) {
                            recordsSkipped++;
                            continue;
                        }
                        try {
                            const countries = result.countries || [];
                            const usCountry = countries.find((c) => US_COUNTRY_NAMES.includes(c.country?.toLowerCase?.()));
                            const usTax = usCountry?.estimatedRevenue ? usCountry.estimatedRevenue * US_TAX_RATE : 0;
                            const existing = await database_1.default.revenueRecord.findUnique({
                                where: { koc_id_cycle_id: { koc_id: koc.id, cycle_id: cycleId } },
                            });
                            if (existing) {
                                const oldRevenue = Number(existing.original_revenue_usd);
                                const oldTax = Number(existing.us_tax_deduction);
                                if (Math.abs(oldRevenue - revenue) > 0.001 || Math.abs(oldTax - usTax) > 0.001) {
                                    await revenue_service_1.RevenueService.updateRecord(existing.id, revenue, usTax, effectiveAdminId);
                                    recordsCreated++;
                                }
                                else {
                                    recordsSkipped++;
                                }
                            }
                            else {
                                await revenue_service_1.RevenueService.createRecord(koc.id, cycleId, revenue, usTax, effectiveAdminId);
                                recordsCreated++;
                            }
                        }
                        catch {
                            recordsSkipped++;
                        }
                    }
                    // Step 3: Also scrape monthly revenue analytics for cross-reference
                    try {
                        logger_middleware_1.default.info('[CronJob] Scraping monthly revenue analytics for cross-reference...');
                        await monthly_revenue_service_1.MonthlyRevenueService.scrapeAllKOCs(effectiveAdminId);
                        logger_middleware_1.default.info('[CronJob] Monthly revenue analytics scraping completed');
                    }
                    catch (monthlyErr) {
                        logger_middleware_1.default.warn(`[CronJob] Monthly analytics scrape failed (non-fatal): ${monthlyErr.message}`);
                    }
                    const msg = `${cycleCreated ? 'Cycle created. ' : ''}Scraped ${scrapeResults.length} channels: ${recordsCreated} records created/updated, ${recordsSkipped} skipped, ${scrapeErrors.length} errors`;
                    logger_middleware_1.default.info(`[CronJob] ${msg}`);
                    await this.addRunHistory(true, msg, previousMonth, adminId);
                    return { success: true, message: msg, cycleMonth: previousMonth };
                }
                catch (scrapeError) {
                    const msg = `${cycleCreated ? 'Cycle created but ' : ''}scrape failed: ${scrapeError.message}`;
                    logger_middleware_1.default.error(`[CronJob] ${msg}`);
                    await this.addRunHistory(false, msg, previousMonth, adminId);
                    return { success: false, message: msg, cycleMonth: previousMonth };
                }
            }
            const msg = `Cycle ${cycleCreated ? 'created' : 'already exists'} for ${previousMonth}. Auto-scrape disabled.`;
            logger_middleware_1.default.info(`[CronJob] ${msg}`);
            await this.addRunHistory(true, msg, previousMonth, adminId);
            return { success: true, message: msg, cycleMonth: previousMonth };
        }
        catch (error) {
            const msg = `Job failed: ${error.message}`;
            logger_middleware_1.default.error(`[CronJob] ${msg}`);
            await this.addRunHistory(false, msg, previousMonth, adminId);
            return { success: false, message: msg, cycleMonth: previousMonth };
        }
    }
    /**
     * Add a run to the history (keep last 20)
     */
    static async addRunHistory(success, message, cycleMonth, adminId) {
        const key = getConfigKey(adminId);
        const config = await this.getConfig(adminId);
        const history = config.runHistory || [];
        history.unshift({
            runAt: new Date().toISOString(),
            success,
            message,
            cycleMonth,
        });
        // Keep only last 20
        if (history.length > 20) {
            history.splice(20);
        }
        await database_1.default.systemConfig.upsert({
            where: { key },
            update: {
                value: {
                    ...config,
                    lastRunAt: new Date().toISOString(),
                    lastRunResult: message,
                    runHistory: history,
                },
            },
            create: {
                key,
                value: {
                    ...config,
                    lastRunAt: new Date().toISOString(),
                    lastRunResult: message,
                    runHistory: history,
                },
            },
        });
    }
    /**
     * Start the cron scheduler
     */
    static async startScheduler(adminId) {
        const taskKey = adminId || '__default__';
        const config = await this.getConfig(adminId);
        // Stop existing task for this admin
        const existing = scheduledTasks.get(taskKey);
        if (existing) {
            existing.stop();
            scheduledTasks.delete(taskKey);
        }
        if (!config.enabled) {
            logger_middleware_1.default.info(`[CronJob] Scheduler disabled for ${taskKey}`);
            return;
        }
        if (!node_cron_1.default.validate(config.schedule)) {
            logger_middleware_1.default.error(`[CronJob] Invalid cron schedule for ${taskKey}: ${config.schedule}`);
            return;
        }
        const task = node_cron_1.default.schedule(config.schedule, async () => {
            logger_middleware_1.default.info(`[CronJob] Scheduled job triggered for admin: ${taskKey}`);
            const result = await this.runJob(adminId);
            // Auto-send revenue emails if configured and job succeeded
            if (result.success && result.cycleMonth) {
                try {
                    const emailConfig = await email_service_1.EmailService.getConfig();
                    if (emailConfig.autoSendAfterCron) {
                        logger_middleware_1.default.info(`[CronJob] Auto-sending revenue emails for month ${result.cycleMonth}...`);
                        const emailResults = await email_service_1.EmailService.sendAllRevenueEmails(result.cycleMonth, adminId || undefined);
                        logger_middleware_1.default.info(`[CronJob] Auto-email results: ${emailResults.sent.length} sent, ${emailResults.failed.length} failed, ${emailResults.skipped.length} skipped`);
                    }
                }
                catch (emailErr) {
                    logger_middleware_1.default.warn(`[CronJob] Auto-email failed (non-fatal): ${emailErr.message}`);
                }
            }
        });
        scheduledTasks.set(taskKey, task);
        logger_middleware_1.default.info(`[CronJob] Scheduler started for ${taskKey} with schedule: ${config.schedule}`);
    }
    /**
     * Start schedulers for all admins that have a saved cron config
     */
    static async startAllSchedulers() {
        const configs = await database_1.default.systemConfig.findMany({
            where: { key: { startsWith: CRON_CONFIG_KEY_PREFIX } },
        });
        if (configs.length === 0) {
            // Fallback: start single default scheduler
            await this.startScheduler();
            return;
        }
        for (const cfg of configs) {
            const adminId = cfg.key === CRON_CONFIG_KEY_PREFIX
                ? undefined
                : cfg.key.replace(`${CRON_CONFIG_KEY_PREFIX}_`, '');
            await this.startScheduler(adminId);
        }
    }
    /**
     * Stop the cron scheduler for a specific admin (or all)
     */
    static stopScheduler(adminId) {
        const taskKey = adminId || '__default__';
        const task = scheduledTasks.get(taskKey);
        if (task) {
            task.stop();
            scheduledTasks.delete(taskKey);
            logger_middleware_1.default.info(`[CronJob] Scheduler stopped for ${taskKey}`);
        }
    }
    /**
     * Restart the scheduler (e.g., after config change)
     */
    static async restartScheduler(adminId) {
        this.stopScheduler(adminId);
        await this.startScheduler(adminId);
    }
    /**
     * Get scheduler status for a specific admin
     */
    static getSchedulerStatus(adminId) {
        const taskKey = adminId || '__default__';
        return { running: scheduledTasks.has(taskKey) };
    }
}
exports.CronService = CronService;
//# sourceMappingURL=cron.service.js.map