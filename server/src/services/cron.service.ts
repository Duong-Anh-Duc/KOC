import cron from 'node-cron';
import prisma from '../config/database';
import logger from '../middlewares/logger.middleware';
import { CycleService } from './cycle.service';
import { EmailService } from './email.service';
import { ExchangeRateService } from './exchange-rate.service';
import { MonthlyRevenueService } from './monthly-revenue.service';
import { RevenueService } from './revenue.service';
import { YouTubeScrapeResultService } from './youtube-scrape-result.service';
import { YouTubeScraperService } from './youtube-scraper.service';

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

const CRON_CONFIG_KEY_PREFIX = 'cron_auto_cycle';

function getConfigKey(adminId?: string): string {
  return adminId ? `${CRON_CONFIG_KEY_PREFIX}_${adminId}` : CRON_CONFIG_KEY_PREFIX;
}

const DEFAULT_CONFIG: CronConfig = {
  enabled: false,
  schedule: '0 3 1 * *', // 3:00 AM on the 1st of every month
  autoCreateCycle: true,
  autoScrapeRevenue: true,
  runHistory: [],
};

const scheduledTasks = new Map<string, cron.ScheduledTask>();

export class CronService {
  /**
   * Get current cron configuration
   */
  static async getConfig(adminId?: string): Promise<CronConfig> {
    const config = await prisma.systemConfig.findUnique({
      where: { key: getConfigKey(adminId) },
    });

    if (!config) {
      return { ...DEFAULT_CONFIG };
    }

    return config.value as unknown as CronConfig;
  }

  /**
   * Update cron configuration
   */
  static async updateConfig(newConfig: Partial<CronConfig>, adminId?: string): Promise<CronConfig> {
    const current = await this.getConfig(adminId);
    const merged: CronConfig = { ...current, ...newConfig };
    const key = getConfigKey(adminId);

    await prisma.systemConfig.upsert({
      where: { key },
      update: { value: merged as any },
      create: { key, value: merged as any },
    });

    // Restart this admin's scheduler with new config
    await this.restartScheduler(adminId);

    return merged;
  }

  /**
   * Get previous month string in MM/YYYY format
   */
  static getPreviousMonth(referenceDate?: Date): string {
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
  static async getNextCycleMonth(): Promise<{
    targetMonth: string;
    canRun: boolean;
    reason?: string;
  }> {
    const now = new Date();
    const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    // Get the latest cycle by month
    const latestCycle = await prisma.revenueCycle.findFirst({
      orderBy: { month: 'desc' },
    });

    let targetMonth: string;

    if (!latestCycle) {
      // No cycles exist, target previous month
      targetMonth = this.getPreviousMonth();
    } else {
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
  static async runJob(adminId?: string): Promise<{ success: boolean; message: string; cycleMonth?: string }> {
    const config = await this.getConfig(adminId);

    // Calculate the actual next cycle month
    const { targetMonth: nextMonth, canRun, reason } = await this.getNextCycleMonth();

    if (!canRun) {
      const msg = reason === 'MONTH_NOT_COMPLETED'
        ? `Cannot create cycle for ${nextMonth}: the month has not ended yet`
        : `Cannot create cycle for ${nextMonth}: the month is in the future`;
      logger.warn(`[CronJob] ${msg}`);
      await this.addRunHistory(false, msg, nextMonth, adminId);
      return { success: false, message: msg, cycleMonth: nextMonth };
    }

    const previousMonth = nextMonth;

    logger.info(`[CronJob] Starting auto-cycle job for month: ${previousMonth}`);

    try {
      // Step 1: Check if cycle already exists
      const existingCycles = await prisma.revenueCycle.findMany({
        where: { month: previousMonth },
      });

      let cycleId: number;
      let cycleCreated = false;

      if (existingCycles.length > 0) {
        cycleId = existingCycles[0].id;
        logger.info(`[CronJob] Cycle for ${previousMonth} already exists (ID: ${cycleId})`);
      } else if (config.autoCreateCycle) {
        // Fetch exchange rate
        let exchangeRate = 25000; // fallback
        try {
          const rateData = await ExchangeRateService.fetchRate();
          exchangeRate = rateData.averageRate || 25000;
          logger.info(`[CronJob] Fetched exchange rate: ${exchangeRate}`);
        } catch (err) {
          logger.warn(`[CronJob] Failed to fetch exchange rate, using default: ${exchangeRate}`);
        }

        // Create cycle
        const cycle = await CycleService.create(previousMonth, exchangeRate);
        cycleId = cycle.id;
        cycleCreated = true;
        logger.info(`[CronJob] Created cycle for ${previousMonth} (ID: ${cycleId})`);
      } else {
        const msg = `Cycle for ${previousMonth} does not exist and autoCreateCycle is disabled`;
        logger.warn(`[CronJob] ${msg}`);
        await this.addRunHistory(false, msg, previousMonth, adminId);
        return { success: false, message: msg, cycleMonth: previousMonth };
      }

      // Step 2: Auto-scrape YouTube revenue
      if (config.autoScrapeRevenue) {
        try {
          const cycle = await CycleService.getById(cycleId);
          if (cycle.status !== 'OPEN') {
            const msg = `Cycle ${previousMonth} is not OPEN (status: ${cycle.status}), skipping scrape`;
            logger.warn(`[CronJob] ${msg}`);
            await this.addRunHistory(true, cycleCreated ? `Cycle created. ${msg}` : msg, previousMonth, adminId);
            return { success: true, message: msg, cycleMonth: previousMonth };
          }

          // Find a valid YouTube session — prefer the current admin's session
          const sessionWhere = adminId
            ? { admin_id: adminId, is_logged_in: true }
            : { is_logged_in: true, admin: { role: 'ADMIN' as const, is_active: true } };
          const adminSession = await prisma.youTubeSession.findFirst({
            where: sessionWhere,
            select: { admin_id: true }
          });

          if (!adminSession) {
            const msg = `No admin with valid YouTube session found. Please login to YouTube Studio first.`;
            logger.warn(`[CronJob] ${msg}`);
            await this.addRunHistory(false, cycleCreated ? `Cycle created. ${msg}` : msg, previousMonth, adminId);
            return { success: false, message: msg, cycleMonth: previousMonth };
          }

          const effectiveAdminId = adminSession.admin_id;
          logger.info(`[CronJob] Using admin ${effectiveAdminId} for scraping`);

          // Get active KOCs scoped to this admin
          const kocs = await prisma.kOC.findMany({
            where: { status: 'ACTIVE', ...(adminId ? { admin_id: adminId } : {}) },
            select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true, base_rate: true },
          });

          if (kocs.length === 0) {
            const msg = `No active KOCs found for scraping`;
            logger.warn(`[CronJob] ${msg}`);
            await this.addRunHistory(true, cycleCreated ? `Cycle created. ${msg}` : msg, previousMonth, adminId);
            return { success: true, message: msg, cycleMonth: previousMonth };
          }

          // Scrape all channels (with admin's Chrome profile)
          const channelIds = kocs
            .map(k => YouTubeScraperService.cleanChannelId(k.youtube_channel_id))
            .filter(id => id && id.length > 0);

          const { results: scrapeResults, errors: scrapeErrors } =
            await YouTubeScraperService.scrapeMultipleChannels(channelIds, undefined, undefined, effectiveAdminId);

          // Map channels to KOCs
          const channelToKocMap = new Map<string, typeof kocs[0]>();
          for (const koc of kocs) {
            if (koc.youtube_channel_id) {
              channelToKocMap.set(YouTubeScraperService.cleanChannelId(koc.youtube_channel_id), koc);
            }
          }

          // Save scrape results
          for (const result of scrapeResults) {
            const koc = channelToKocMap.get(result.channelId);
            if (koc) {
              await YouTubeScrapeResultService.saveResult(koc.id, koc.youtube_channel_id, result);
            }
          }

          // Create revenue records
          const US_TAX_RATE = 0.30;
          const US_COUNTRY_NAMES = ['hoa kỳ', 'united states', 'us', 'usa', 'états-unis'];
          let recordsCreated = 0;
          let recordsSkipped = 0;

          for (const result of scrapeResults) {
            const koc = channelToKocMap.get(result.channelId);
            if (!koc) continue;

            const revenue = result.totals.estimatedRevenue;
            if (revenue == null || revenue <= 0) {
              recordsSkipped++;
              continue;
            }

            try {
              const countries = result.countries || [];
              const usCountry = countries.find((c: any) =>
                US_COUNTRY_NAMES.includes(c.country?.toLowerCase?.())
              );
              const usTax = usCountry?.estimatedRevenue ? usCountry.estimatedRevenue * US_TAX_RATE : 0;

              const existing = await prisma.revenueRecord.findUnique({
                where: { koc_id_cycle_id: { koc_id: koc.id, cycle_id: cycleId } },
              });

              if (existing) {
                const oldRevenue = Number(existing.original_revenue_usd);
                const oldTax = Number(existing.us_tax_deduction);
                if (Math.abs(oldRevenue - revenue) > 0.001 || Math.abs(oldTax - usTax) > 0.001) {
                  await RevenueService.updateRecord(existing.id, revenue, usTax, effectiveAdminId);
                  recordsCreated++;
                } else {
                  recordsSkipped++;
                }
              } else {
                await RevenueService.createRecord(koc.id, cycleId, revenue, usTax, effectiveAdminId);
                recordsCreated++;
              }
            } catch {
              recordsSkipped++;
            }
          }

          // Step 3: Also scrape monthly revenue analytics for cross-reference
          try {
            logger.info('[CronJob] Scraping monthly revenue analytics for cross-reference...');
            await MonthlyRevenueService.scrapeAllKOCs(effectiveAdminId);
            logger.info('[CronJob] Monthly revenue analytics scraping completed');
          } catch (monthlyErr: any) {
            logger.warn(`[CronJob] Monthly analytics scrape failed (non-fatal): ${monthlyErr.message}`);
          }

          const msg = `${cycleCreated ? 'Cycle created. ' : ''}Scraped ${scrapeResults.length} channels: ${recordsCreated} records created/updated, ${recordsSkipped} skipped, ${scrapeErrors.length} errors`;
          logger.info(`[CronJob] ${msg}`);
          await this.addRunHistory(true, msg, previousMonth, adminId);
          return { success: true, message: msg, cycleMonth: previousMonth };
        } catch (scrapeError: any) {
          const msg = `${cycleCreated ? 'Cycle created but ' : ''}scrape failed: ${scrapeError.message}`;
          logger.error(`[CronJob] ${msg}`);
          await this.addRunHistory(false, msg, previousMonth, adminId);
          return { success: false, message: msg, cycleMonth: previousMonth };
        }
      }

      const msg = `Cycle ${cycleCreated ? 'created' : 'already exists'} for ${previousMonth}. Auto-scrape disabled.`;
      logger.info(`[CronJob] ${msg}`);
      await this.addRunHistory(true, msg, previousMonth, adminId);
      return { success: true, message: msg, cycleMonth: previousMonth };
    } catch (error: any) {
      const msg = `Job failed: ${error.message}`;
      logger.error(`[CronJob] ${msg}`);
      await this.addRunHistory(false, msg, previousMonth, adminId);
      return { success: false, message: msg, cycleMonth: previousMonth };
    }
  }

  /**
   * Add a run to the history (keep last 20)
   */
  private static async addRunHistory(success: boolean, message: string, cycleMonth?: string, adminId?: string) {
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

    await prisma.systemConfig.upsert({
      where: { key },
      update: {
        value: {
          ...config,
          lastRunAt: new Date().toISOString(),
          lastRunResult: message,
          runHistory: history,
        } as any,
      },
      create: {
        key,
        value: {
          ...config,
          lastRunAt: new Date().toISOString(),
          lastRunResult: message,
          runHistory: history,
        } as any,
      },
    });
  }

  /**
   * Start the cron scheduler
   */
  static async startScheduler(adminId?: string) {
    const taskKey = adminId || '__default__';
    const config = await this.getConfig(adminId);

    // Stop existing task for this admin
    const existing = scheduledTasks.get(taskKey);
    if (existing) {
      existing.stop();
      scheduledTasks.delete(taskKey);
    }

    if (!config.enabled) {
      logger.info(`[CronJob] Scheduler disabled for ${taskKey}`);
      return;
    }

    if (!cron.validate(config.schedule)) {
      logger.error(`[CronJob] Invalid cron schedule for ${taskKey}: ${config.schedule}`);
      return;
    }

    const task = cron.schedule(config.schedule, async () => {
      logger.info(`[CronJob] Scheduled job triggered for admin: ${taskKey}`);
      const result = await this.runJob(adminId);

      // Auto-send revenue emails if configured and job succeeded
      if (result.success && result.cycleMonth) {
        try {
          const emailConfig = await EmailService.getConfig();
          if (emailConfig.autoSendAfterCron) {
            logger.info(`[CronJob] Auto-sending revenue emails for month ${result.cycleMonth}...`);
            const emailResults = await EmailService.sendAllRevenueEmails(result.cycleMonth, adminId || undefined);
            logger.info(`[CronJob] Auto-email results: ${emailResults.sent.length} sent, ${emailResults.failed.length} failed, ${emailResults.skipped.length} skipped`);
          }
        } catch (emailErr: any) {
          logger.warn(`[CronJob] Auto-email failed (non-fatal): ${emailErr.message}`);
        }
      }
    });

    scheduledTasks.set(taskKey, task);
    logger.info(`[CronJob] Scheduler started for ${taskKey} with schedule: ${config.schedule}`);
  }

  /**
   * Start schedulers for all admins that have a saved cron config
   */
  static async startAllSchedulers() {
    const configs = await prisma.systemConfig.findMany({
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
  static stopScheduler(adminId?: string) {
    const taskKey = adminId || '__default__';
    const task = scheduledTasks.get(taskKey);
    if (task) {
      task.stop();
      scheduledTasks.delete(taskKey);
      logger.info(`[CronJob] Scheduler stopped for ${taskKey}`);
    }
  }

  /**
   * Restart the scheduler (e.g., after config change)
   */
  static async restartScheduler(adminId?: string) {
    this.stopScheduler(adminId);
    await this.startScheduler(adminId);
  }

  /**
   * Get scheduler status for a specific admin
   */
  static getSchedulerStatus(adminId?: string): { running: boolean } {
    const taskKey = adminId || '__default__';
    return { running: scheduledTasks.has(taskKey) };
  }
}

// ============================================================
// MONTHLY REVENUE SPOT-SCRAPER — every ~2-3 minutes, 1 random KOC
// ============================================================

let monthlySpotTask: NodeJS.Timeout | null = null;
let monthlySpotRunning = false;

export class MonthlySpotScraperService {
  /**
   * Start the spot-scraper.
   * Every 2.5 minutes picks a random active KOC and scrapes monthly revenue for January
   * of the current year. Skips if a scrape is already in progress.
   */
  static start(): void {
    if (monthlySpotTask) return; // already running

    const INTERVAL_MS = 150_000; // 2.5 minutes
    const run = async () => {
      if (monthlySpotRunning) {
        logger.debug('[MonthlySpot] Previous run still in progress — skipping');
        return;
      }
      if (YouTubeScraperService.isAnyScrapingActive()) {
        logger.debug('[MonthlySpot] Another scrape in progress — skipping');
        return;
      }

      monthlySpotRunning = true;
      let adminId: string | undefined;
      let koc: { id: string; channel_name: string; youtube_channel_id: string } | undefined;
      try {
        // Find a valid admin session
        const session = await prisma.youTubeSession.findFirst({
          where: { is_logged_in: true },
          select: { admin_id: true },
        });
        if (!session) {
          logger.debug('[MonthlySpot] No active YouTube session — skipping');
          return;
        }
        adminId = session.admin_id;

        // Pick a random active KOC
        const kocs = await prisma.kOC.findMany({
          where: { status: 'ACTIVE', admin_id: adminId },
          select: { id: true, channel_name: true, youtube_channel_id: true },
        });
        if (kocs.length === 0) {
          logger.debug('[MonthlySpot] No active KOCs found — skipping');
          return;
        }
        koc = kocs[Math.floor(Math.random() * kocs.length)];

        // Scrape tháng 1 of current year
        const year = new Date().getFullYear();
        const month = `01/${year}`;

        logger.info(`[MonthlySpot] Scraping ${koc.channel_name} — ${month}`);
        const data = await MonthlyRevenueService.scrapeAndSave(
          koc.id,
          koc.youtube_channel_id,
          adminId,
          koc.channel_name,
        );
        logger.info(`[MonthlySpot] Done: ${koc.channel_name} — ${data.months.length} tháng`);
      } catch (err: any) {
        logger.warn(`[MonthlySpot] Error: ${err.message}`);
        if (err.message === 'NOT_LOGGED_IN') {
          YouTubeScraperService.markSessionDisconnected('monthly_spot_not_logged_in', undefined, adminId, {
            trigger: 'MonthlySpotScraperService',
            failedChannel: koc?.channel_name ?? 'unknown',
          }).catch(() => {});
        }
      } finally {
        monthlySpotRunning = false;
      }
    };

    monthlySpotTask = setInterval(run, INTERVAL_MS);
    logger.info('[MonthlySpot] Scheduler started — every 2.5 min, 1 random KOC, tháng 01');
  }

  static stop(): void {
    if (monthlySpotTask) {
      clearInterval(monthlySpotTask);
      monthlySpotTask = null;
      logger.info('[MonthlySpot] Scheduler stopped');
    }
  }

  static isRunning(): boolean {
    return monthlySpotTask !== null;
  }
}
