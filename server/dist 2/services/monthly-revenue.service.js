"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonthlyRevenueService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../config/database"));
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
const parseHelpers_1 = require("../utils/parseHelpers");
const revenue_service_1 = require("./revenue.service");
const youtube_scraper_service_1 = require("./youtube-scraper.service");
class MonthlyRevenueService {
    /**
     * Build URL for monthly revenue explore page
     * This uses dimension=MONTH and granularity=MONTH to get per-month breakdown
     * Matching the URL pattern from YouTube Studio
     */
    static buildMonthlyRevenueUrl(channelId) {
        const cleanId = youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(channelId);
        return `https://studio.youtube.com/channel/${cleanId}/analytics/tab-earn_revenue/period-default/explore?entity_type=CHANNEL&entity_id=${cleanId}&time_period=year&explore_type=TABLE_AND_CHART&metric=TOTAL_ESTIMATED_EARNINGS&granularity=MONTH&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=AVERAGE_WATCH_TIME&t_metrics=TOTAL_ESTIMATED_EARNINGS&dimension=MONTH&o_column=MONTH&o_direction=ANALYTICS_ORDER_DIRECTION_DESC&comparison_type=NONE`;
    }
    /**
     * Scrape monthly revenue data for a channel using the existing browser session
     */
    static async scrapeMonthlyRevenue(channelId, adminId) {
        const url = this.buildMonthlyRevenueUrl(channelId);
        const cleanId = youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(channelId);
        logger_middleware_1.default.info(`📊 Scraping monthly revenue for channel: ${cleanId}`);
        const MAX_ATTEMPTS = 3;
        let lastError = new Error('Unknown error');
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const context = await youtube_scraper_service_1.YouTubeScraperService.getContext(false, adminId);
            const page = await context.newPage();
            try {
                // Block heavy resources (images, fonts, media) to save RAM on VPS
                await page.route('**/*', (route) => {
                    const type = route.request().resourceType();
                    if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
                        return route.abort();
                    }
                    return route.continue();
                });
                // Navigate to blank first to initialize page cleanly and reduce memory pressure
                try {
                    await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 });
                }
                catch { /* ignore */ }
                await new Promise(r => setTimeout(r, 500));
                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                }
                catch (err) {
                    logger_middleware_1.default.warn(`⚠️ Page load timeout (attempt ${attempt}), continuing...`, err.message);
                }
                // Check login
                if (page.url().includes('accounts.google.com')) {
                    throw new Error('NOT_LOGGED_IN');
                }
                // YouTube Studio shows "unsupported browser" page for headless/automated browsers.
                // Detect and click through to proceed to Studio directly.
                await new Promise(r => setTimeout(r, 2000));
                const bodySnippet = await page.evaluate('document.body.innerText').catch(() => '');
                if (bodySnippet.includes('CHUYỂN THẲNG ĐẾN YOUTUBE STUDIO') || bodySnippet.includes('Go to YouTube Studio')) {
                    logger_middleware_1.default.warn(`⚠️ "Unsupported browser" page detected — clicking through to Studio...`);
                    const link = page.locator('a:has-text("CHUYỂN THẲNG ĐẾN YOUTUBE STUDIO"), a:has-text("Go to YouTube Studio")');
                    if (await link.count() > 0) {
                        await link.first().click();
                        await page.waitForLoadState('domcontentloaded').catch(() => { });
                        await new Promise(r => setTimeout(r, 3000));
                    }
                    else {
                        // Fallback: navigate directly stripping the unsupported browser redirect
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
                    }
                }
                // Wait for analytics to render, then retry up to 3x if content too short
                let text = '';
                for (let waitAttempt = 1; waitAttempt <= 3; waitAttempt++) {
                    await new Promise(r => setTimeout(r, waitAttempt === 1 ? 6000 : 5000));
                    text = await Promise.race([
                        page.evaluate('document.body.innerText'),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout extracting text')), 30000)),
                    ]);
                    if (text.length >= 1000)
                        break;
                    logger_middleware_1.default.warn(`⚠️ Content too short (${text.length} chars), waiting longer... (${waitAttempt}/3)`);
                }
                logger_middleware_1.default.info(`✓ Scraped monthly revenue page (${text.length} chars)`);
                if (text.length < 500) {
                    // Dump raw content to errors folder for debugging
                    try {
                        const errDir = path_1.default.join(process.cwd(), 'errors');
                        if (!fs_1.default.existsSync(errDir))
                            fs_1.default.mkdirSync(errDir, { recursive: true });
                        const ts = new Date().toISOString().replace(/[:.]/g, '-');
                        fs_1.default.writeFileSync(path_1.default.join(errDir, `monthly_${cleanId}_${ts}.txt`), text, 'utf8');
                        logger_middleware_1.default.warn(`[Debug] Raw page content saved to errors/monthly_${cleanId}_${ts}.txt`);
                    }
                    catch { /* ignore */ }
                    throw new Error(`Page content too short (${text.length} chars) — data not loaded`);
                }
                // Navigate away to free memory
                try {
                    await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 });
                }
                catch { /* ignore */ }
                // Parse the monthly revenue data
                const parsed = this.parseMonthlyRevenueText(text);
                return {
                    channelId: cleanId,
                    totals: parsed.totals,
                    months: parsed.months,
                    scrapedAt: new Date().toISOString(),
                };
            }
            catch (err) {
                lastError = err;
                const isCrash = err.message?.includes('Target crashed') ||
                    err.message?.includes('Target closed') ||
                    err.message?.includes('Session closed') ||
                    err.message?.includes('existing browser session') ||
                    err.message?.includes('Opening in existing');
                if (err.message === 'NOT_LOGGED_IN')
                    throw err; // no retry for auth errors
                if (isCrash && attempt < MAX_ATTEMPTS) {
                    logger_middleware_1.default.warn(`📊 Monthly scrape attempt ${attempt} crashed — clearing context and retrying in 5s...`);
                    try {
                        await page.close();
                    }
                    catch { /* already dead */ }
                    // Invalidate the corrupt context so getContext() creates a fresh one
                    try {
                        const ctx = await youtube_scraper_service_1.YouTubeScraperService.getContext(false, adminId).catch(() => null);
                        if (ctx)
                            await ctx.close();
                    }
                    catch { /* ignore */ }
                    await new Promise(r => setTimeout(r, 5000));
                    continue;
                }
                throw err;
            }
            finally {
                try {
                    await page.close();
                }
                catch { /* ignore */ }
            }
        }
        throw lastError;
    }
    /**
     * Parse the monthly revenue explore page text.
     * Expected format (Vietnamese):
     *   Ngày ↓ | Số lượt xem ⚠ | Thời gian xem (giờ) | Thời lượng xem trung bình | Doanh thu ước tính
     *   Tổng   | 106.766.532    | 441.649,8           | 0:27                      | 1.327,87 $
     *   Tháng 2 (đang diễn ra) | 2.729.250 2,6% | 12.646,8 2,9% | 0:31 | 24,98 $ 1,9%
     *   Tháng 1 | 7.215.190 6,8% | 35.540,2 8,1% | 0:33 | 81,96 $ 6,2%
     */
    static parseMonthlyRevenueText(text) {
        const totals = {
            views: null,
            watchTimeHours: null,
            avgWatchTime: null,
            estimatedRevenue: null,
        };
        const months = [];
        try {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            let inTable = false;
            let foundTotal = false;
            // Detect approximate current year from context
            const currentYear = new Date().getFullYear();
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Detect table header
                if (/^(Ngày|Day)/i.test(line) || /Doanh thu ước tính|Estimated revenue/i.test(line)) {
                    inTable = true;
                    continue;
                }
                if (!inTable)
                    continue;
                // Parse "Tổng" (Total) row
                if (/^Tổng$|^Total$/i.test(line) && !foundTotal) {
                    foundTotal = true;
                    const rowValues = this.extractRowValues(lines, i + 1, 5);
                    if (rowValues.length >= 1)
                        totals.views = (0, parseHelpers_1.parseIntegerValue)(rowValues[0]);
                    if (rowValues.length >= 2)
                        totals.watchTimeHours = (0, parseHelpers_1.parseDecimalValue)(rowValues[1]);
                    if (rowValues.length >= 3)
                        totals.avgWatchTime = (0, parseHelpers_1.parseTimeValue)(rowValues[2]);
                    if (rowValues.length >= 4)
                        totals.estimatedRevenue = (0, parseHelpers_1.parseRevenueValue)(rowValues[3]);
                    continue;
                }
                // Parse month rows (after Tổng)
                if (foundTotal) {
                    const monthMatch = line.match(/^(Tháng\s+\d+(?:\s*\(.*?\))?|Month\s+\d+)/i);
                    if (monthMatch) {
                        const monthLabel = line;
                        const monthNum = this.extractMonthNumber(monthLabel);
                        const monthKey = this.computeMonthKey(monthNum, currentYear, months.length);
                        const rowValues = this.extractRowValues(lines, i + 1, 9);
                        const row = {
                            monthLabel,
                            monthKey,
                            views: null,
                            viewsPercent: null,
                            watchTimeHours: null,
                            watchTimePercent: null,
                            avgWatchTime: null,
                            estimatedRevenue: null,
                            revenuePercent: null,
                        };
                        // Parse values: views, views%, watchTime, watchTime%, avgWatch, revenue, revenue%
                        let vidx = 0;
                        for (const val of rowValues) {
                            if (vidx === 0 && /^[\d.]+$/.test(val.replace(/\./g, ''))) {
                                row.views = (0, parseHelpers_1.parseIntegerValue)(val);
                                vidx = 1;
                            }
                            else if (vidx === 1 && /%/.test(val)) {
                                row.viewsPercent = (0, parseHelpers_1.parsePercentValue)(val);
                                vidx = 2;
                            }
                            else if (vidx <= 2 && /^[\d.,]+$/.test(val) && val.includes(',')) {
                                row.watchTimeHours = (0, parseHelpers_1.parseDecimalValue)(val);
                                vidx = 3;
                            }
                            else if (vidx === 3 && /%/.test(val)) {
                                row.watchTimePercent = (0, parseHelpers_1.parsePercentValue)(val);
                                vidx = 4;
                            }
                            else if (vidx <= 4 && /^\d{1,2}:\d{2}$/.test(val)) {
                                row.avgWatchTime = val;
                                vidx = 5;
                            }
                            else if (vidx <= 5 && /[$₫]/.test(val)) {
                                row.estimatedRevenue = (0, parseHelpers_1.parseRevenueValue)(val);
                                vidx = 6;
                            }
                            else if (vidx === 6 && /%/.test(val)) {
                                row.revenuePercent = (0, parseHelpers_1.parsePercentValue)(val);
                                vidx = 7;
                            }
                            else if (vidx === 1 && /^[\d.,]+$/.test(val) && val.includes(',')) {
                                // No views% - jump to watch time
                                row.watchTimeHours = (0, parseHelpers_1.parseDecimalValue)(val);
                                vidx = 3;
                            }
                        }
                        // Handle revenue with dash (–) meaning no data
                        months.push(row);
                        continue;
                    }
                    // Stop if we leave the table area
                    if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao/i.test(line)) {
                        break;
                    }
                }
            }
        }
        catch (err) {
            logger_middleware_1.default.error('Error parsing monthly revenue text:', err);
        }
        return { totals, months };
    }
    /**
     * Extract month number from label like "Tháng 2 (đang diễn ra)" → 2
     */
    static extractMonthNumber(label) {
        const m = label.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
    }
    /**
     * Compute month_key in YYYY-MM format
     * YouTube Studio shows months in DESC order: current month first, then back in time
     * We need to figure out the year based on the month number pattern
     */
    static computeMonthKey(monthNum, currentYear, indexInList) {
        // The list is sorted DESC by date, so first item is most recent
        // Current month of Feb 2026: Tháng 2 = current, Tháng 1 = same year
        // Tháng 12 (before current) = previous year, etc.
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        // Calculate the actual date by going back from current month
        let targetMonth = currentMonth - indexInList;
        let targetYear = currentYear;
        while (targetMonth <= 0) {
            targetMonth += 12;
            targetYear -= 1;
        }
        // But we also have the actual month number from the label, use it for correction
        if (monthNum > 0) {
            // If monthNum is bigger than currentMonth and this isn't the first item,
            // it must be from the previous year
            if (monthNum > currentMonth || (monthNum === currentMonth && indexInList > 0)) {
                targetYear = currentYear - 1;
            }
            else {
                targetYear = currentYear;
            }
            // Check if we need to go further back
            const expectedMonth = currentMonth - indexInList;
            if (expectedMonth <= 0) {
                targetYear = currentYear + Math.floor((expectedMonth - 1) / 12);
            }
            targetMonth = monthNum;
        }
        return `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    }
    // ========================
    // ROW VALUE EXTRACTION (specific to monthly revenue table)
    // ========================
    static extractRowValues(lines, startIdx, maxValues) {
        const values = [];
        for (let i = startIdx; i < Math.min(startIdx + maxValues + 5, lines.length); i++) {
            const line = lines[i];
            // Stop if we hit a month label or section header
            if (/^(Tháng|Month|Tổng|Total|Ngày|Day)/i.test(line))
                break;
            // Value patterns  
            if (/[\d$%:₫]/.test(line) && line.length < 30) {
                values.push(line);
                if (values.length >= maxValues)
                    break;
            }
            // Also handle dash (–) as no-data marker
            if (/^[–\-]$/.test(line.trim())) {
                values.push('–');
                if (values.length >= maxValues)
                    break;
            }
        }
        return values;
    }
    // ========================
    // DATABASE OPERATIONS
    // ========================
    /**
     * Save monthly revenue data for a KOC
     */
    static async saveMonthlyRevenue(kocId, channelId, data) {
        const saved = [];
        for (const month of data.months) {
            try {
                const result = await database_1.default.monthlyRevenueAnalytics.upsert({
                    where: {
                        koc_id_month_key: {
                            koc_id: kocId,
                            month_key: month.monthKey,
                        },
                    },
                    update: {
                        views: month.views != null ? BigInt(month.views) : null,
                        views_percent: month.viewsPercent,
                        watch_time_hours: month.watchTimeHours,
                        watch_time_percent: month.watchTimePercent,
                        avg_watch_time: month.avgWatchTime,
                        estimated_revenue: month.estimatedRevenue,
                        revenue_percent: month.revenuePercent,
                        month_label: month.monthLabel,
                        scraped_at: new Date(data.scrapedAt),
                    },
                    create: {
                        koc_id: kocId,
                        channel_id: channelId,
                        month_label: month.monthLabel,
                        month_key: month.monthKey,
                        views: month.views != null ? BigInt(month.views) : null,
                        views_percent: month.viewsPercent,
                        watch_time_hours: month.watchTimeHours,
                        watch_time_percent: month.watchTimePercent,
                        avg_watch_time: month.avgWatchTime,
                        estimated_revenue: month.estimatedRevenue,
                        revenue_percent: month.revenuePercent,
                        scraped_at: new Date(data.scrapedAt),
                    },
                });
                saved.push(result);
            }
            catch (err) {
                logger_middleware_1.default.error(`Failed to save month ${month.monthKey} for KOC ${kocId}:`, err.message);
            }
        }
        logger_middleware_1.default.info(`💾 Saved ${saved.length} monthly revenue records for KOC ${kocId}`);
        return saved;
    }
    /**
     * Get monthly revenue analytics for a KOC
     */
    static async getByKOC(kocId) {
        const results = await database_1.default.monthlyRevenueAnalytics.findMany({
            where: { koc_id: kocId },
            orderBy: { month_key: 'desc' },
            include: {
                koc: {
                    select: { full_name: true, channel_name: true, youtube_channel_id: true },
                },
            },
        });
        return results.map(r => ({
            ...r,
            views: r.views != null ? Number(r.views) : null,
            views_percent: r.views_percent != null ? Number(r.views_percent) : null,
            watch_time_hours: r.watch_time_hours != null ? Number(r.watch_time_hours) : null,
            watch_time_percent: r.watch_time_percent != null ? Number(r.watch_time_percent) : null,
            estimated_revenue: r.estimated_revenue != null ? Number(r.estimated_revenue) : null,
            revenue_percent: r.revenue_percent != null ? Number(r.revenue_percent) : null,
        }));
    }
    /**
     * After saving monthly data, auto-sync revenue into matching open cycles.
     * monthKey format: "2026-01" → cycle month: "01/2026"
     */
    static async syncToCycles(kocId, months) {
        let synced = 0;
        for (const month of months) {
            if (month.estimatedRevenue == null)
                continue;
            // Convert "2026-01" → "01/2026"
            const [year, mm] = month.monthKey.split('-');
            const cycleMonth = `${mm}/${year}`;
            try {
                // Find an OPEN cycle matching this month (scoped to the KOC's admin)
                const koc = await database_1.default.kOC.findUnique({ where: { id: kocId }, select: { admin_id: true, base_rate: true } });
                if (!koc)
                    continue;
                const cycle = await database_1.default.revenueCycle.findFirst({
                    where: { month: cycleMonth, status: 'OPEN', ...(koc.admin_id ? { admin_id: koc.admin_id } : {}) },
                });
                if (!cycle)
                    continue;
                const record = await database_1.default.revenueRecord.findUnique({
                    where: { koc_id_cycle_id: { koc_id: kocId, cycle_id: cycle.id } },
                });
                if (!record)
                    continue;
                // Recalculate all derived fields with the new revenue
                const calculated = revenue_service_1.RevenueService.calculate({
                    originalRevenueUsd: month.estimatedRevenue,
                    usTaxDeduction: Number(record.us_tax_deduction),
                    baseRate: Number(koc.base_rate),
                    exchangeRate: Number(cycle.exchange_rate),
                });
                await database_1.default.revenueRecord.update({
                    where: { id: record.id },
                    data: calculated,
                });
                synced++;
                logger_middleware_1.default.info(`[MonthlySync] Updated cycle ${cycleMonth} record for KOC ${kocId}: $${month.estimatedRevenue}`);
            }
            catch (err) {
                logger_middleware_1.default.warn(`[MonthlySync] Failed to sync ${month.monthKey} for KOC ${kocId}: ${err.message}`);
            }
        }
        if (synced > 0)
            logger_middleware_1.default.info(`[MonthlySync] Synced ${synced} cycle record(s) for KOC ${kocId}`);
    }
    /**
     * Scrape and save monthly revenue for a single KOC
     */
    static async scrapeAndSave(kocId, channelId, adminId, channelName) {
        let data = null;
        let scrapeError = null;
        try {
            data = await this.scrapeMonthlyRevenue(channelId, adminId);
            await this.saveMonthlyRevenue(kocId, channelId, data);
            await this.syncToCycles(kocId, data.months);
        }
        catch (err) {
            scrapeError = err.message;
            throw err;
        }
        finally {
            this.writeMonthlyLog(channelId, channelName, data, scrapeError);
        }
        return data;
    }
    static writeMonthlyLog(channelId, channelName, data, error) {
        try {
            const logsDir = path_1.default.join(process.cwd(), 'logs', 'monthly');
            if (!fs_1.default.existsSync(logsDir))
                fs_1.default.mkdirSync(logsDir, { recursive: true });
            const label = (channelName || channelId).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u0300-\u036f\p{L}]/gu, '_');
            const year = new Date().getFullYear();
            const filePath = path_1.default.join(logsDir, `${label}_${year}.log`);
            const timestamp = new Date().toLocaleString('vi-VN');
            const lines = [];
            lines.push(`========================================`);
            lines.push(`Thời gian   : ${timestamp}`);
            lines.push(`Channel ID  : ${channelId}`);
            if (error) {
                lines.push(`Trạng thái  : ❌ THẤT BẠI`);
                lines.push(`Lỗi         : ${error}`);
            }
            else if (data) {
                lines.push(`Trạng thái  : ✅ THÀNH CÔNG (${data.months.length} tháng)`);
                for (const m of data.months) {
                    lines.push(`  ${m.monthKey.padEnd(8)} DT: $${(m.estimatedRevenue ?? 0).toFixed(2).padStart(10)}  Views: ${(m.views ?? 0).toLocaleString()}`);
                }
            }
            lines.push('');
            fs_1.default.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
        }
        catch { /* ignore log errors */ }
    }
    /**
     * Scrape and save monthly revenue for all active KOCs
     */
    static async scrapeAllKOCs(adminId, onProgress, kocIds) {
        const kocs = await database_1.default.kOC.findMany({
            where: {
                status: 'ACTIVE',
                ...(adminId ? { admin_id: adminId } : {}),
                ...(kocIds && kocIds.length > 0 ? { id: { in: kocIds } } : {}),
            },
            select: { id: true, full_name: true, channel_name: true, youtube_channel_id: true },
        });
        const results = [];
        const errors = [];
        const total = kocs.length;
        for (let i = 0; i < kocs.length; i++) {
            const koc = kocs[i];
            if (onProgress)
                onProgress(i + 1, total, koc.channel_name);
            try {
                logger_middleware_1.default.info(`[${i + 1}/${total}] 📊 Scraping monthly revenue for ${koc.channel_name}`);
                const data = await this.scrapeAndSave(koc.id, koc.youtube_channel_id, adminId, koc.channel_name);
                results.push({ kocId: koc.id, channelName: koc.channel_name, monthCount: data.months.length });
                if (i < kocs.length - 1) {
                    // Random delay 8-15s to mimic human browsing (avoid fixed-interval bot pattern)
                    const delay = 8000 + Math.floor(Math.random() * 7000);
                    // Extra 30s pause every 10 channels to avoid sustained activity detection
                    const extraPause = (i + 1) % 10 === 0 ? 30000 : 0;
                    await new Promise(r => setTimeout(r, delay + extraPause));
                }
            }
            catch (err) {
                logger_middleware_1.default.error(`❌ Failed for ${koc.channel_name}: ${err.message}`);
                errors.push({ kocId: koc.id, channelName: koc.channel_name, error: err.message });
                if (err.message === 'NOT_LOGGED_IN') {
                    youtube_scraper_service_1.YouTubeScraperService.markSessionDisconnected('monthly_scrape_not_logged_in', undefined, adminId, {
                        trigger: 'MonthlyRevenueService.scrapeAllKOCs',
                        failedChannel: koc.channel_name,
                        channelIndex: String(i),
                    }).catch(() => { });
                    break;
                }
            }
        }
        return { results, errors };
    }
}
exports.MonthlyRevenueService = MonthlyRevenueService;
//# sourceMappingURL=monthly-revenue.service.js.map