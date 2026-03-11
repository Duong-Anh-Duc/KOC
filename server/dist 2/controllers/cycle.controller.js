"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CycleController = void 0;
const database_1 = __importDefault(require("../config/database"));
const constants_1 = require("../constants");
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
const services_1 = require("../services");
const progress_service_1 = require("../services/progress.service");
const pub_code_service_1 = require("../services/pub-code.service");
const youtube_scrape_result_service_1 = require("../services/youtube-scrape-result.service");
const youtube_scraper_service_1 = require("../services/youtube-scraper.service");
class CycleController {
    /**
     * GET /api/cycles
     */
    static async getAll(_req, res, next) {
        try {
            const authReq = _req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const cycles = await services_1.CycleService.getAll(adminId);
            const t = _req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cycle.listRetrieved') : 'Cycles retrieved',
                data: cycles,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/cycles/:id
     */
    static async getById(req, res, next) {
        try {
            const authReq = req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const cycle = await services_1.CycleService.getById(Number(req.params.id), adminId);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cycle.retrieved') : 'Cycle retrieved',
                data: cycle,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/cycles
     */
    static async create(req, res, next) {
        try {
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const { month, exchange_rate } = req.body;
            const cycle = await services_1.CycleService.create(month, exchange_rate, adminId);
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.CREATE_CYCLE, constants_1.ENTITIES.REVENUE_CYCLE, String(cycle.id), null, cycle);
            }
            const t = req.t;
            res.status(201).json({
                success: true,
                message: t ? t('cycle.created') : 'Revenue cycle created',
                data: cycle,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/cycles/:id/add-kocs
     * Body: { kocIds?: string[] }  — omit to add ALL missing active KOCs
     */
    static async addKocs(req, res, next) {
        try {
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const { kocIds } = req.body;
            const result = await services_1.CycleService.addKocs(Number(req.params.id), kocIds, adminId);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cycle.kocsAdded', { count: result.added }) : `Added ${result.added} KOC(s) to cycle`,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PUT /api/cycles/:id
     */
    static async update(req, res, next) {
        try {
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const cycle = await services_1.CycleService.update(Number(req.params.id), req.body, adminId);
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.UPDATE_CYCLE, constants_1.ENTITIES.REVENUE_CYCLE, String(cycle.id), null, cycle);
            }
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cycle.updated') : 'Revenue cycle updated',
                data: cycle,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /api/cycles/:id/lock
     */
    static async lock(req, res, next) {
        try {
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const cycle = await services_1.CycleService.lock(Number(req.params.id), adminId);
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.LOCK_CYCLE, constants_1.ENTITIES.REVENUE_CYCLE, String(cycle.id), { status: 'OPEN' }, { status: 'LOCKED' });
            }
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cycle.locked') : 'Revenue cycle locked',
                data: cycle,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /api/cycles/:id/reopen
     */
    static async reopen(req, res, next) {
        try {
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const oldCycle = await services_1.CycleService.getById(Number(req.params.id), adminId);
            const cycle = await services_1.CycleService.reopen(Number(req.params.id), adminId);
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.REOPEN_CYCLE, constants_1.ENTITIES.REVENUE_CYCLE, String(cycle.id), { status: oldCycle.status }, { status: 'OPEN' });
            }
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cycle.reopened') : 'Revenue cycle reopened',
                data: cycle,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /api/cycles/:id/complete
     */
    static async complete(req, res, next) {
        try {
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const cycle = await services_1.CycleService.complete(Number(req.params.id), adminId);
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.COMPLETE_CYCLE, constants_1.ENTITIES.REVENUE_CYCLE, String(cycle.id), { status: 'LOCKED' }, { status: 'PAYMENT_COMPLETED' });
            }
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cycle.completed') : 'Revenue cycle completed',
                data: cycle,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * DELETE /api/cycles/:id
     */
    static async delete(req, res, next) {
        try {
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const cycle = await services_1.CycleService.delete(Number(req.params.id), adminId);
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.UPDATE_CYCLE, constants_1.ENTITIES.REVENUE_CYCLE, String(req.params.id), cycle, null);
            }
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cycle.deleted') : 'Revenue cycle deleted',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/cycles/exchange-rate
     * Fetch current USD/VND exchange rate from webgia.com
     */
    static async getExchangeRate(_req, res, next) {
        try {
            const data = await services_1.ExchangeRateService.fetchRate();
            const t = _req.t;
            res.status(200).json({
                success: true,
                message: t ? t('cycle.exchangeRateFetched') : 'Exchange rate fetched',
                data,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/cycles/:id/scrape-revenue
     * Scrape YouTube revenue for all active KOCs for the cycle's month,
     * then auto-create revenue records from the scraped data
     */
    static async scrapeRevenue(req, res, next) {
        try {
            const t = req.t;
            const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
            const cycleId = Number(req.params.id);
            const cycle = await services_1.CycleService.getById(cycleId, adminId);
            if (cycle.status !== 'OPEN') {
                res.status(400).json({ success: false, message: t ? t('ytScraper.cycleNotOpen') : 'Cycle is not OPEN' });
                return;
            }
            const month = cycle.month;
            const taskId = progress_service_1.ProgressService.generateTaskId('scrape-revenue');
            // Optional: filter by specific KOC IDs
            const kocIds = req.body?.kocIds;
            // Return taskId immediately so client can subscribe to SSE
            res.status(202).json({
                success: true,
                message: t ? t('progress.taskStarted') : 'Task started',
                data: { taskId },
            });
            // Run scrape in background with progress reporting
            logger_middleware_1.default.info(`🚀 Starting scrape-revenue task ${taskId} for cycle ${cycleId} (month: ${month}, admin: ${req.user?.userId}, kocIds: ${kocIds ? kocIds.length : 'all'})`);
            CycleController.runScrapeRevenue(cycleId, month, taskId, req.user?.userId || null, kocIds).catch(err => {
                logger_middleware_1.default.error(`❌ scrape-revenue task ${taskId} failed:`, err.message, err.stack);
                progress_service_1.ProgressService.error(taskId, err.message);
            });
        }
        catch (error) {
            const t = req.t;
            if (error.message === 'NOT_LOGGED_IN') {
                res.status(401).json({
                    success: false,
                    message: t ? t('ytScraper.notLoggedIn') : 'Not logged in to YouTube Studio. Please login first.',
                });
                return;
            }
            next(error);
        }
    }
    /**
     * POST /api/cycles/:id/check-pub-codes
     * Check pub codes for all KOCs in a cycle, update revenue records
     */
    static async checkPubCodes(req, res, next) {
        try {
            const t = req.t;
            const cycleId = Number(req.params.id);
            const taskId = progress_service_1.ProgressService.generateTaskId('check-pub-codes');
            res.status(202).json({
                success: true,
                message: t ? t('progress.taskStarted') : 'Task started',
                data: { taskId },
            });
            CycleController.runCheckPubCodes(cycleId, taskId, req.user?.userId || null).catch(err => {
                logger_middleware_1.default.error(`❌ check-pub-codes task ${taskId} failed:`, err.message);
                progress_service_1.ProgressService.error(taskId, err.message);
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async runCheckPubCodes(cycleId, taskId, userId) {
        try {
            // Get unique KOCs that have records in this cycle
            const records = await database_1.default.revenueRecord.findMany({
                where: { cycle_id: cycleId },
                include: { koc: { select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true, pub_code: true } } },
            });
            if (records.length === 0) {
                progress_service_1.ProgressService.complete(taskId, { total: 0, matched: 0, mismatched: 0, noData: 0, errors: 0, results: [] });
                return;
            }
            // Deduplicate: check each KOC only once
            const kocMap = new Map();
            for (const r of records) {
                if (!kocMap.has(r.koc.id))
                    kocMap.set(r.koc.id, r.koc);
            }
            const kocs = Array.from(kocMap.values());
            progress_service_1.ProgressService.emit(taskId, { step: 0, total: kocs.length, percent: 0, message: `Kiểm tra mã Pub cho ${kocs.length} KOC...` });
            const results = [];
            let matched = 0, mismatched = 0, noData = 0, errors = 0;
            for (let i = 0; i < kocs.length; i++) {
                const koc = kocs[i];
                const percent = Math.round(((i + 1) / kocs.length) * 100);
                progress_service_1.ProgressService.emit(taskId, {
                    step: i + 1, total: kocs.length, percent,
                    message: `Checking ${koc.channel_name || koc.full_name} (${i + 1}/${kocs.length})`,
                });
                try {
                    const scrapedPubCode = await pub_code_service_1.PubCodeService.scrapePubCode(koc.youtube_channel_id, userId || undefined);
                    const pubCodeMatch = scrapedPubCode && koc.pub_code ? scrapedPubCode === koc.pub_code : null;
                    // Update ALL revenue records for this KOC (across all cycles)
                    await database_1.default.revenueRecord.updateMany({
                        where: { koc_id: koc.id },
                        data: { scraped_pub_code: scrapedPubCode, pub_code_match: pubCodeMatch },
                    });
                    results.push({ koc: koc.channel_name || koc.full_name, stored: koc.pub_code, scraped: scrapedPubCode, matched: pubCodeMatch });
                    if (pubCodeMatch === true)
                        matched++;
                    else if (pubCodeMatch === false)
                        mismatched++;
                    else
                        noData++;
                }
                catch (err) {
                    results.push({ koc: koc.channel_name || koc.full_name, stored: koc.pub_code, scraped: null, matched: null, error: err.message });
                    errors++;
                }
                if (i < kocs.length - 1)
                    await new Promise(r => setTimeout(r, 1500));
            }
            progress_service_1.ProgressService.complete(taskId, { total: kocs.length, matched, mismatched, noData, errors, results });
        }
        catch (error) {
            progress_service_1.ProgressService.error(taskId, error.message);
        }
    }
    /**
     * Background method to run scrape revenue with progress
     */
    static async runScrapeRevenue(cycleId, month, taskId, userId, kocIds) {
        try {
            const kocs = await database_1.default.kOC.findMany({
                where: {
                    status: 'ACTIVE',
                    ...(userId ? { admin_id: userId } : {}),
                    ...(kocIds && kocIds.length > 0 ? { id: { in: kocIds } } : {}),
                },
                select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true, base_rate: true },
            });
            if (kocs.length === 0) {
                progress_service_1.ProgressService.error(taskId, 'No active KOCs found');
                return;
            }
            const channelIds = kocs
                .map(k => youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(k.youtube_channel_id))
                .filter(id => id && id.length > 0);
            const totalSteps = channelIds.length + kocs.length;
            let currentStep = 0;
            progress_service_1.ProgressService.emit(taskId, {
                step: 0, total: totalSteps, percent: 0,
                message: `Starting scrape for ${channelIds.length} channels...`,
            });
            const channelToKocMap = new Map();
            for (const koc of kocs) {
                if (koc.youtube_channel_id) {
                    channelToKocMap.set(youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(koc.youtube_channel_id), koc);
                }
            }
            // Build channel label map (channelId → KOC name) for log file naming
            const channelLabels = new Map();
            for (const [cId, koc] of channelToKocMap.entries()) {
                channelLabels.set(cId, koc.channel_name || koc.full_name || cId);
            }
            // Scrape channels with progress callback — pass the cycle month so correct period is scraped
            const { results: scrapeResults, errors: scrapeErrors } = await youtube_scraper_service_1.YouTubeScraperService.scrapeMultipleChannels(channelIds, month, (channelId, idx, total) => {
                currentStep = idx + 1;
                const koc = channelToKocMap.get(channelId);
                const percent = Math.round((currentStep / totalSteps) * 100);
                progress_service_1.ProgressService.emit(taskId, {
                    step: currentStep, total: totalSteps, percent,
                    message: `Scraping ${koc?.channel_name || channelId} (${idx + 1}/${total})`,
                });
            }, userId || undefined, channelLabels);
            // Save scrape results to DB
            for (const result of scrapeResults) {
                const koc = channelToKocMap.get(result.channelId);
                if (koc) {
                    await youtube_scrape_result_service_1.YouTubeScrapeResultService.saveResult(koc.id, koc.youtube_channel_id, result);
                }
            }
            // Create/update revenue records with progress
            const US_TAX_RATE = 0.30;
            const US_COUNTRY_NAMES = ['hoa kỳ', 'united states', 'us', 'usa', 'états-unis'];
            const created = [];
            const updated = [];
            const skipped = [];
            for (let i = 0; i < scrapeResults.length; i++) {
                const result = scrapeResults[i];
                const koc = channelToKocMap.get(result.channelId);
                if (!koc)
                    continue;
                currentStep = channelIds.length + i + 1;
                const percent = Math.round((currentStep / totalSteps) * 100);
                progress_service_1.ProgressService.emit(taskId, {
                    step: currentStep, total: totalSteps, percent,
                    message: `Creating record for ${koc.channel_name} (${i + 1}/${scrapeResults.length})`,
                });
                const revenue = result.totals.estimatedRevenue;
                if (revenue == null) {
                    skipped.push({ koc: koc.channel_name, reason: 'No revenue data' });
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
                        await services_1.RevenueService.updateRecord(existing.id, revenue, usTax, userId || undefined);
                        updated.push({ koc: koc.channel_name, revenue });
                    }
                    else {
                        await services_1.RevenueService.createRecord(koc.id, cycleId, revenue, usTax, userId || undefined);
                        created.push({ koc: koc.channel_name, revenue });
                    }
                    // ── Compute accumulated amounts for this KOC ──
                    // Previous PENDING months (other cycles) + this cycle's record
                    try {
                        const currentRecord = await database_1.default.revenueRecord.findUnique({
                            where: { koc_id_cycle_id: { koc_id: koc.id, cycle_id: cycleId } },
                        });
                        if (currentRecord) {
                            const prevPending = await database_1.default.revenueRecord.findMany({
                                where: { koc_id: koc.id, status: 'PENDING', cycle_id: { lt: cycleId } },
                            });
                            const accRevenue = prevPending.reduce((s, r) => s + Number(r.original_revenue_usd), 0) + Number(currentRecord.original_revenue_usd);
                            const accKoc = prevPending.reduce((s, r) => s + Number(r.koc_receive_usd), 0) + Number(currentRecord.koc_receive_usd);
                            await database_1.default.revenueRecord.update({
                                where: { id: currentRecord.id },
                                data: { accumulated_revenue_usd: Math.round(accRevenue * 100) / 100, accumulated_koc_usd: Math.round(accKoc * 100) / 100 },
                            });
                        }
                    }
                    catch (accErr) {
                        logger_middleware_1.default.warn(`⚠️ Failed to compute accumulated for ${koc.channel_name}: ${accErr.message}`);
                    }
                }
                catch (error) {
                    skipped.push({ koc: koc.channel_name, reason: error.message });
                }
            }
            // Audit log
            if (userId) {
                await services_1.AuditLogService.log(userId, 'SCRAPE_REVENUE', constants_1.ENTITIES.REVENUE_CYCLE, String(cycleId), null, { month, created: created.length, updated: updated.length, skipped: skipped.length, errors: scrapeErrors.length });
            }
            // Auto-approve removed — records accumulate until manually approved by admin.
            // min_payment is only a display condition (belowThreshold flag) not a trigger.
            const autoApproved = [];
            // Send final result via SSE
            progress_service_1.ProgressService.complete(taskId, {
                month,
                created,
                updated,
                skipped,
                scrapeErrors,
                autoApproved,
                summary: {
                    totalKOCs: kocs.length,
                    scraped: scrapeResults.length,
                    recordsCreated: created.length,
                    recordsUpdated: updated.length,
                    recordsSkipped: skipped.length,
                    scrapeFailed: scrapeErrors.length,
                    autoApproved: autoApproved.length,
                },
            });
        }
        catch (error) {
            progress_service_1.ProgressService.error(taskId, error.message);
        }
    }
}
exports.CycleController = CycleController;
//# sourceMappingURL=cycle.controller.js.map