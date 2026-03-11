"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialBladeService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../config/database"));
const middlewares_1 = require("../middlewares");
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
const parseHelpers_1 = require("../utils/parseHelpers");
const exchange_rate_service_1 = require("./exchange-rate.service");
const progress_service_1 = require("./progress.service");
const youtube_scraper_service_1 = require("./youtube-scraper.service");
// ============================================================
// Column Specs for Table Parsing
// ============================================================
/**
 * Country table column order (15 columns):
 * Subs Gained, Subs Lost, Likes, Dislikes, Like%, Shares,
 * New Viewers, Returning Viewers, Avg Watch Time,
 * Views, Watch Time (hrs), Subscribers Net,
 * Est Revenue, Thumbnail Impressions, Thumbnail CTR
 */
const COUNTRY_COL_SPECS = [
    { key: 'subscribersGained', type: 'number_percent' },
    { key: 'subscribersLost', type: 'number_percent' },
    { key: 'likes', type: 'number_percent' },
    { key: 'dislikes', type: 'number_percent' },
    { key: 'likeRatio', type: 'standalone_percent_or_dash' },
    { key: 'shares', type: 'number_percent' },
    { key: 'newViewers', type: 'standalone_num_or_dash' },
    { key: 'returningViewers', type: 'standalone_num_or_dash' },
    { key: 'avgWatchTime', type: 'standalone_time' },
    { key: 'views', type: 'number_percent' },
    { key: 'watchTimeHours', type: 'number_percent' },
    { key: 'subscribersNet', type: 'number_percent' },
    { key: 'estimatedRevenue', type: 'dollar_percent' },
    { key: 'thumbnailImpressions', type: 'standalone_num_or_dash' },
    { key: 'thumbnailCTR', type: 'standalone_percent_or_dash' },
];
/**
 * Day table column order (4 columns):
 * Views, Watch Time (hrs), Avg Watch Time, Est Revenue
 */
const DAY_COL_SPECS = [
    { key: 'views', type: 'number_percent' },
    { key: 'watchTimeHours', type: 'number_percent' },
    { key: 'avgWatchTime', type: 'standalone_time' },
    { key: 'estimatedRevenue', type: 'dollar_percent' },
];
// ============================================================
// Service
// ============================================================
class SocialBladeService {
    // ============================================================
    // URL BUILDERS
    // ============================================================
    /**
     * Build URL for 28-day explore by country
     */
    static buildCountryExploreUrl(channelId) {
        const id = youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(channelId);
        return `https://studio.youtube.com/channel/${id}/analytics/tab-earn_revenue/period-default/explore?c=${id}&entity_type=CHANNEL&entity_id=${id}&time_period=4_weeks&explore_type=TABLE_AND_CHART&chart_type=LINE_CHART&metric=SUBSCRIBERS_GAINED&granularity=DAY&t_metrics=SUBSCRIBERS_GAINED&t_metrics=SUBSCRIBERS_LOST&t_metrics=RATINGS_LIKES&t_metrics=RATINGS_DISLIKES&t_metrics=LIKES_PER_LIKES_PLUS_DISLIKES_PERCENT&t_metrics=SHARINGS&t_metrics=RECENT_VIEWERS&t_metrics=RETURNING_VIEWERS&t_metrics=AVERAGE_WATCH_TIME&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=SUBSCRIBERS_NET_CHANGE&t_metrics=TOTAL_ESTIMATED_EARNINGS&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS&t_metrics=VIDEO_THUMBNAIL_IMPRESSIONS_VTR&dimension=COUNTRY&o_column=SUBSCRIBERS_GAINED&o_direction=ANALYTICS_ORDER_DIRECTION_DESC`;
    }
    /**
     * Build URL for 28-day explore by day
     */
    static buildDayExploreUrl(channelId) {
        const id = youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(channelId);
        return `https://studio.youtube.com/channel/${id}/analytics/tab-earn_revenue/period-default/explore?c=${id}&entity_type=CHANNEL&entity_id=${id}&time_period=4_weeks&explore_type=TABLE_AND_CHART&chart_type=LINE_CHART&metric=EXTERNAL_VIEWS&granularity=DAY&t_metrics=EXTERNAL_VIEWS&t_metrics=EXTERNAL_WATCH_TIME&t_metrics=AVERAGE_WATCH_TIME&t_metrics=TOTAL_ESTIMATED_EARNINGS&dimension=DAY&o_column=DAY&o_direction=ANALYTICS_ORDER_DIRECTION_DESC`;
    }
    // ============================================================
    // PAGE SCRAPING
    // ============================================================
    /**
     * Navigate to an explore page and extract body text
     */
    static async scrapeExplorePage(page, url, label) {
        logger_middleware_1.default.info(`📊 Scraping ${label}...`);
        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
        }
        catch (err) {
            logger_middleware_1.default.warn(`⚠️ Page load warning for ${label}: ${err.message}`);
            // Try with domcontentloaded if networkidle fails
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            }
            catch (retryErr) {
                logger_middleware_1.default.error(`❌ Page load failed for ${label}: ${retryErr.message}`);
                throw retryErr;
            }
        }
        if (page.url().includes('accounts.google.com')) {
            throw new Error('NOT_LOGGED_IN');
        }
        // Click through "unsupported browser" page if shown
        await new Promise(r => setTimeout(r, 1500));
        const bodyCheck = await page.evaluate('document.body.innerText').catch(() => '');
        if (bodyCheck.includes('CHUYỂN THẲNG ĐẾN YOUTUBE STUDIO') || bodyCheck.includes('Go to YouTube Studio')) {
            logger_middleware_1.default.warn(`⚠️ "Unsupported browser" page detected for ${label} — clicking through...`);
            const link = page.locator('a:has-text("CHUYỂN THẲNG ĐẾN YOUTUBE STUDIO"), a:has-text("Go to YouTube Studio")');
            if (await link.count() > 0) {
                await link.first().click();
                await page.waitForLoadState('domcontentloaded').catch(() => { });
                await new Promise(r => setTimeout(r, 3000));
            }
            else {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
            }
        }
        // Wait for analytics table to fully render (longer wait for complex tables)
        logger_middleware_1.default.info(`⏳ Waiting for ${label} to fully load...`);
        await new Promise(r => setTimeout(r, 10000));
        // Try to wait for table elements to appear
        try {
            await page.waitForSelector('[role="rowgroup"], table, [role="table"]', { timeout: 15000 });
            logger_middleware_1.default.info(`✓ Table element found for ${label}`);
        }
        catch (err) {
            logger_middleware_1.default.warn(`⚠️ Table selector not found for ${label}, proceeding anyway`);
        }
        const text = await Promise.race([
            page.evaluate('document.body.innerText'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout extracting text')), 60000)),
        ]);
        logger_middleware_1.default.info(`✓ ${label}: extracted ${text.length} chars`);
        // Log first 500 chars for debugging
        if (text.length > 0) {
            logger_middleware_1.default.info(`📝 First 500 chars: ${text.substring(0, 500)}`);
        }
        return text;
    }
    // ============================================================
    // COUNTRY TABLE PARSER
    // ============================================================
    /**
     * Parse the by-country explore table text
     */
    static parseCountryExploreText(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const nullTotals = {
            subscribersGained: null, subscribersLost: null, likes: null, dislikes: null,
            likeRatio: null, shares: null, newViewers: null, returningViewers: null,
            avgWatchTime: null, views: null, watchTimeHours: null, subscribersNet: null,
            estimatedRevenue: null, thumbnailImpressions: null, thumbnailCTR: null,
        };
        // Find "Tổng" (Total) row
        let totalIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/^(Tổng|Total)$/i.test(lines[i]) && i + 1 < lines.length && (0, parseHelpers_1.isValueLine)(lines[i + 1])) {
                totalIdx = i;
                logger_middleware_1.default.info(`✓ Found "Tổng" row at index ${i}: "${lines[i]}"`);
                break;
            }
        }
        if (totalIdx === -1) {
            logger_middleware_1.default.warn('⚠️ Could not find "Tổng" row in country explore text');
            logger_middleware_1.default.warn(`📄 Total lines: ${lines.length}`);
            logger_middleware_1.default.warn(`📄 First 20 lines: ${lines.slice(0, 20).join(' | ')}`);
            logger_middleware_1.default.warn(`📄 Lines containing "Tổng" or "Total": ${lines.filter(l => /tổng|total/i.test(l)).join(' | ')}`);
            return { totals: nullTotals, rows: [] };
        }
        // Collect total row values (15 values max, scan up to 50 lines)
        const totalValues = [];
        const maxScanLines = Math.min(totalIdx + 50, lines.length);
        let lastValueLineIdx = totalIdx;
        for (let i = totalIdx + 1; i < maxScanLines && totalValues.length < 15; i++) {
            const line = lines[i];
            // Stop if we hit UI elements or section breaks
            if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode|Mostrar gráfico|Ocultar gráfico|Modo avanzado/i.test(line))
                break;
            if (/xác minh|danh tính|tìm hiểu|tiếp theo|verificar|identidad|más información|siguiente|verify|identity|learn more|next|continue|confirmar|información/i.test(line))
                break;
            // Stop if we encounter a country name (start of dimension rows)
            if ((0, parseHelpers_1.isCountryName)(line))
                break;
            // Skip date lines (headers)
            if ((0, parseHelpers_1.isDateLine)(line))
                continue;
            // Collect value lines
            if ((0, parseHelpers_1.isValueLine)(line)) {
                totalValues.push(line.trim());
                lastValueLineIdx = i;
            }
            // Continue scanning even for non-value lines (don't break immediately)
        }
        logger_middleware_1.default.info(`📊 Collected ${totalValues.length} total values: ${totalValues.join(' | ')}`);
        const totals = (0, parseHelpers_1.parseTotalRow)(totalValues, COUNTRY_COL_SPECS);
        logger_middleware_1.default.info(`📋 Country totals parsed: views=${totals.views}, subsGained=${totals.subscribersGained}, subsNet=${totals.subscribersNet}, revenue=${totals.estimatedRevenue}`);
        // Parse country rows (start after last total value line)
        const rows = [];
        let i = lastValueLineIdx + 1;
        while (i < lines.length) {
            const line = lines[i];
            // Stop at UI elements or verification prompts (Vietnamese, English, Spanish)
            if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode|Mostrar gráfico|Ocultar gráfico|Modo avanzado/i.test(line))
                break;
            if (/xác minh|danh tính|tìm hiểu|tiếp theo|verificar|identidad|más información|siguiente|verify|identity|learn more|next|continue|confirmar|información/i.test(line))
                break;
            if ((0, parseHelpers_1.isCountryName)(line)) {
                const country = line;
                i++;
                const values = [];
                while (i < lines.length && (0, parseHelpers_1.isValueLine)(lines[i])) {
                    values.push(lines[i].trim());
                    i++;
                }
                const row = (0, parseHelpers_1.parseDimensionRowValues)(country, values, COUNTRY_COL_SPECS, 'country');
                rows.push(row);
            }
            else {
                i++;
            }
        }
        logger_middleware_1.default.info(`📋 Parsed ${rows.length} country rows`);
        return { totals: totals, rows };
    }
    // ============================================================
    // DAY TABLE PARSER
    // ============================================================
    /**
     * Parse the by-day explore table text
     */
    static parseDayExploreText(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const nullTotals = {
            views: null, watchTimeHours: null, avgWatchTime: null, estimatedRevenue: null,
        };
        // Find "Tổng" (Total) row
        let totalIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/^(Tổng|Total)$/i.test(lines[i]) && i + 1 < lines.length && (0, parseHelpers_1.isValueLine)(lines[i + 1])) {
                totalIdx = i;
                logger_middleware_1.default.info(`✓ Found "Tổng" row at index ${i}: "${lines[i]}"`);
                break;
            }
        }
        if (totalIdx === -1) {
            logger_middleware_1.default.warn('⚠️ Could not find "Tổng" row in day explore text');
            logger_middleware_1.default.warn(`📄 Total lines: ${lines.length}`);
            logger_middleware_1.default.warn(`📄 First 20 lines: ${lines.slice(0, 20).join(' | ')}`);
            logger_middleware_1.default.warn(`📄 Lines containing "Tổng" or "Total": ${lines.filter(l => /tổng|total/i.test(l)).join(' | ')}`);
            return { totals: nullTotals, rows: [] };
        }
        // Collect total row values (4 values max, scan up to 30 lines)
        const totalValues = [];
        const maxScanLines = Math.min(totalIdx + 30, lines.length);
        let lastValueLineIdx = totalIdx;
        for (let i = totalIdx + 1; i < maxScanLines && totalValues.length < 4; i++) {
            const line = lines[i];
            // Stop if we hit UI elements or section breaks
            if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode|Mostrar gráfico|Ocultar gráfico|Modo avanzado/i.test(line))
                break;
            if (/xác minh|danh tính|tìm hiểu|tiếp theo|verificar|identidad|más información|siguiente|verify|identity|learn more|next|continue|confirmar|información/i.test(line))
                break;
            // Stop if we encounter a date line (start of dimension rows)
            if ((0, parseHelpers_1.isDateLine)(line))
                break;
            // Skip country names (shouldn't be in day table but just in case)
            if ((0, parseHelpers_1.isCountryName)(line))
                continue;
            // Collect value lines
            if ((0, parseHelpers_1.isValueLine)(line)) {
                totalValues.push(line.trim());
                lastValueLineIdx = i;
            }
            // Continue scanning even for non-value lines (don't break immediately)
        }
        logger_middleware_1.default.info(`📊 Collected ${totalValues.length} total values: ${totalValues.join(' | ')}`);
        const totals = (0, parseHelpers_1.parseTotalRow)(totalValues, DAY_COL_SPECS);
        logger_middleware_1.default.info(`📋 Day totals parsed: views=${totals.views}, subsGained=${totals.subscribersGained}, subsNet=${totals.subscribersNet}, revenue=${totals.estimatedRevenue}`);
        // Parse day rows (start after last total value line)
        const rows = [];
        let i = lastValueLineIdx + 1;
        while (i < lines.length) {
            const line = lines[i];
            // Stop at UI elements or verification prompts (Vietnamese, English, Spanish)
            if (/Hiện biểu đồ|Ẩn biểu đồ|Show chart|Hide chart|Chế độ nâng cao|Advanced mode|Mostrar gráfico|Ocultar gráfico|Modo avanzado/i.test(line))
                break;
            if (/xác minh|danh tính|tìm hiểu|tiếp theo|verificar|identidad|más información|siguiente|verify|identity|learn more|next|continue|confirmar|información/i.test(line))
                break;
            if ((0, parseHelpers_1.isDateLine)(line)) {
                const date = line;
                i++;
                const values = [];
                while (i < lines.length && (0, parseHelpers_1.isValueLine)(lines[i])) {
                    values.push(lines[i].trim());
                    i++;
                }
                const row = (0, parseHelpers_1.parseDimensionRowValues)(date, values, DAY_COL_SPECS, 'day');
                rows.push(row);
            }
            else {
                i++;
            }
        }
        logger_middleware_1.default.info(`📋 Parsed ${rows.length} day rows`);
        return { totals: totals, rows };
    }
    // ============================================================
    // MAIN SCRAPING METHOD
    // ============================================================
    /**
     * Scrape both explore tables (by country + by day) for a channel
     */
    static async scrapeChannelStats(channelId, adminId, channelName) {
        const context = await youtube_scraper_service_1.YouTubeScraperService.getContext(false, adminId);
        const page = await context.newPage();
        let result = null;
        let scrapeError = null;
        try {
            // 1. Scrape country table
            const countryUrl = this.buildCountryExploreUrl(channelId);
            const countryText = await this.scrapeExplorePage(page, countryUrl, `country stats [${channelId}]`);
            const countryData = this.parseCountryExploreText(countryText);
            // 2. Scrape day table
            const dayUrl = this.buildDayExploreUrl(channelId);
            const dayText = await this.scrapeExplorePage(page, dayUrl, `day stats [${channelId}]`);
            const dayData = this.parseDayExploreText(dayText);
            result = { byCountry: countryData, byDay: dayData, scrapedAt: new Date().toISOString() };
            return result;
        }
        catch (err) {
            scrapeError = err.message;
            throw err;
        }
        finally {
            try {
                await page.close();
            }
            catch { /* ignore */ }
            this.write28DayLog(channelId, channelName, result, scrapeError);
        }
    }
    static write28DayLog(channelId, channelName, data, error) {
        try {
            const logsDir = path_1.default.join(process.cwd(), 'logs', '28days');
            if (!fs_1.default.existsSync(logsDir))
                fs_1.default.mkdirSync(logsDir, { recursive: true });
            const label = (channelName || channelId).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u0300-\u036f\p{L}]/gu, '_');
            const dateTag = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            const filePath = path_1.default.join(logsDir, `${label}_${dateTag}.log`);
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
                const t = data.byCountry.totals;
                lines.push(`Trạng thái  : ✅ THÀNH CÔNG`);
                lines.push(`Lượt xem    : ${(t.views ?? 0).toLocaleString()}`);
                lines.push(`Giờ xem     : ${t.watchTimeHours ?? 0}`);
                lines.push(`Doanh thu   : $${(t.estimatedRevenue ?? 0).toFixed(2)}`);
                lines.push(`Ngày cào    : ${data.byDay.rows.length} ngày`);
                if (data.byCountry.rows.length > 0) {
                    lines.push(`--- Theo quốc gia (top 5) ---`);
                    for (const r of data.byCountry.rows.slice(0, 5)) {
                        lines.push(`  ${(r.country ?? '').padEnd(20)} $${(r.estimatedRevenue ?? 0).toFixed(2)}`);
                    }
                }
            }
            lines.push('');
            fs_1.default.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
        }
        catch { /* ignore log errors */ }
    }
    // ============================================================
    // DATABASE METHODS
    // ============================================================
    /**
     * Fetch and save 28d stats for a single KOC
     */
    static async recordStats(kocId, adminId) {
        const koc = await database_1.default.kOC.findUnique({ where: { id: kocId } });
        if (!koc)
            throw new middlewares_1.ApiError(404, 'koc.notFound');
        const stats = await this.scrapeChannelStats(koc.youtube_channel_id, adminId, koc.channel_name);
        const record = await database_1.default.channelStat.create({
            data: {
                koc_id: kocId,
                view_count: stats.byCountry.totals.views || 0,
                sub_count: stats.byCountry.totals.subscribersNet || 0,
                yt_analytics: stats,
            },
        });
        return record;
    }
    /**
     * Fetch and save 28d stats for all active KOCs
     */
    static async recordAllStats(adminId) {
        const kocs = await database_1.default.kOC.findMany({ where: { status: 'ACTIVE', ...(adminId ? { admin_id: adminId } : {}) } });
        const results = [];
        const errors = [];
        logger_middleware_1.default.info(`📊 Starting to fetch 28d stats for ${kocs.length} KOCs...`);
        for (const koc of kocs) {
            try {
                logger_middleware_1.default.info(`🔄 Fetching stats for ${koc.channel_name}...`);
                const stats = await this.scrapeChannelStats(koc.youtube_channel_id, adminId, koc.channel_name);
                const record = await database_1.default.channelStat.create({
                    data: {
                        koc_id: koc.id,
                        view_count: stats.byCountry.totals.views || 0,
                        sub_count: stats.byCountry.totals.subscribersNet || 0,
                        yt_analytics: stats,
                    },
                });
                results.push(record);
                logger_middleware_1.default.info(`✅ 28d stats recorded for ${koc.channel_name} (${results.length}/${kocs.length})`);
            }
            catch (error) {
                errors.push({ kocId: koc.id, channelName: koc.channel_name, error: String(error) });
                logger_middleware_1.default.error(`❌ Failed to record 28d stats for ${koc.channel_name}: ${error}`);
                if (error?.message === 'NOT_LOGGED_IN') {
                    youtube_scraper_service_1.YouTubeScraperService.markSessionDisconnected('28day_scrape_not_logged_in', undefined, adminId, {
                        trigger: 'SocialBladeService.recordAllStats',
                        failedChannel: koc.channel_name,
                    }).catch(() => { });
                    break;
                }
            }
            // Delay between scrapes (3s)
            await new Promise(r => setTimeout(r, 3000));
        }
        logger_middleware_1.default.info(`Stats completed: ${results.length} success, ${errors.length} failed`);
        return { success: results.length, failed: errors.length, errors };
    }
    /**
     * Same as recordAllStats but emits SSE progress events via ProgressService.
     */
    static async recordAllStatsWithProgress(taskId, adminId) {
        const kocs = await database_1.default.kOC.findMany({ where: { status: 'ACTIVE', ...(adminId ? { admin_id: adminId } : {}) } });
        const total = kocs.length;
        const results = [];
        const errors = [];
        logger_middleware_1.default.info(`Starting to fetch 28d stats for ${total} KOCs (taskId: ${taskId})...`);
        for (let i = 0; i < kocs.length; i++) {
            const koc = kocs[i];
            const step = i + 1;
            const percent = Math.round((i / total) * 100);
            progress_service_1.ProgressService.emit(taskId, {
                step,
                total,
                percent,
                message: `Đang xử lý: ${koc.channel_name} (${step}/${total})`,
            });
            try {
                const stats = await this.scrapeChannelStats(koc.youtube_channel_id, adminId, koc.channel_name);
                await database_1.default.channelStat.create({
                    data: {
                        koc_id: koc.id,
                        view_count: stats.byCountry.totals.views || 0,
                        sub_count: stats.byCountry.totals.subscribersNet || 0,
                        yt_analytics: stats,
                    },
                });
                results.push(koc.id);
                logger_middleware_1.default.info(`Stats recorded for ${koc.channel_name} (${results.length}/${total})`);
            }
            catch (error) {
                errors.push({ kocId: koc.id, channelName: koc.channel_name, error: String(error) });
                logger_middleware_1.default.error(`Failed to record stats for ${koc.channel_name}: ${error}`);
                if (error?.message === 'NOT_LOGGED_IN') {
                    youtube_scraper_service_1.YouTubeScraperService.markSessionDisconnected('28day_scrape_not_logged_in', undefined, adminId, {
                        trigger: 'SocialBladeService.recordAllStatsWithProgress',
                        failedChannel: koc.channel_name,
                        channelIndex: String(i),
                    }).catch(() => { });
                    break;
                }
            }
            if (i < kocs.length - 1) {
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        const resultData = { success: results.length, failed: errors.length, errors };
        logger_middleware_1.default.info(`Stats fetch completed: ${results.length} success, ${errors.length} failed`);
        progress_service_1.ProgressService.complete(taskId, resultData);
        return resultData;
    }
    // ============================================================
    // QUERY METHODS
    // ============================================================
    /**
     * Get channel stats history
     */
    static async getStatsHistory(kocId, days = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const stats = await database_1.default.channelStat.findMany({
            where: {
                koc_id: kocId,
                recorded_at: { gte: since },
            },
            orderBy: { recorded_at: 'asc' },
        });
        return stats.map(stat => ({
            ...stat,
            view_count: stat.view_count != null ? Number(stat.view_count) : null,
            sub_count: stat.sub_count != null ? Number(stat.sub_count) : null,
        }));
    }
    /**
     * Get latest stats for all KOCs
     */
    static async getLatestStats(adminId) {
        const where = { status: 'ACTIVE' };
        if (adminId)
            where.admin_id = adminId;
        const kocs = await database_1.default.kOC.findMany({
            where,
            include: {
                channel_stats: {
                    orderBy: { recorded_at: 'desc' },
                    take: 1,
                },
            },
        });
        return kocs.map((koc) => ({
            koc_id: koc.id,
            full_name: koc.full_name,
            channel_name: koc.channel_name,
            latest_stats: koc.channel_stats[0] || null,
        }));
    }
    /**
     * Get 28d growth summary for all KOCs
     * Supports both new (byCountry/byDay) and old (overview/content/audience) formats
     */
    static normalizeRevenueToUsd(val) {
        if (!val)
            return 0;
        // If value exceeds realistic USD threshold (5000), assume it's raw VND and convert
        if (val > 5000) {
            return exchange_rate_service_1.ExchangeRateService.convertVndToUsd(val) || 0;
        }
        return val; // Already in USD
    }
    /**
     * Get 28d growth summary for all KOCs
     * Supports both new (byCountry/byDay) and old (overview/content/audience) formats
     */
    static async getAllKocsGrowth(adminId) {
        const where = { status: 'ACTIVE' };
        if (adminId)
            where.admin_id = adminId;
        const kocs = await database_1.default.kOC.findMany({
            where,
            include: {
                channel_stats: {
                    orderBy: { recorded_at: 'desc' },
                    take: 1,
                },
            },
        });
        return kocs.map((koc) => {
            const latest = koc.channel_stats[0] || null;
            const yt = latest?.yt_analytics;
            const isNewFormat = yt?.byCountry !== undefined;
            if (isNewFormat) {
                const ct = yt.byCountry?.totals;
                return {
                    koc_id: koc.id,
                    full_name: koc.full_name,
                    channel_name: koc.channel_name,
                    youtube_channel_id: koc.youtube_channel_id,
                    views_28d_num: ct?.views || 0,
                    watch_time_hours_28d_num: ct?.watchTimeHours || 0,
                    subs_gained_28d_num: ct?.subscribersGained || 0,
                    subs_lost_28d_num: ct?.subscribersLost || 0,
                    subs_net_28d_num: ct?.subscribersNet || 0,
                    estimated_revenue_28d_num: this.normalizeRevenueToUsd(ct?.estimatedRevenue),
                    likes_28d_num: ct?.likes || 0,
                    shares_28d_num: ct?.shares || 0,
                    has_data: true,
                    last_recorded_at: latest?.recorded_at || null,
                };
            }
            else if (yt?.overview) {
                // Backward compat for old format
                return {
                    koc_id: koc.id,
                    full_name: koc.full_name,
                    channel_name: koc.channel_name,
                    youtube_channel_id: koc.youtube_channel_id,
                    views_28d_num: yt.overview.views28d_num || 0,
                    watch_time_hours_28d_num: yt.overview.watchTimeHours28d_num || 0,
                    subs_gained_28d_num: yt.overview.subscribers28d_num || 0,
                    subs_lost_28d_num: 0,
                    subs_net_28d_num: yt.overview.subscribers28d_num || 0,
                    estimated_revenue_28d_num: this.normalizeRevenueToUsd(yt.overview.estimatedRevenue28d_num),
                    likes_28d_num: yt.content?.likes28d_num || 0,
                    shares_28d_num: 0,
                    has_data: true,
                    last_recorded_at: latest?.recorded_at || null,
                };
            }
            else {
                return {
                    koc_id: koc.id,
                    full_name: koc.full_name,
                    channel_name: koc.channel_name,
                    youtube_channel_id: koc.youtube_channel_id,
                    views_28d_num: 0,
                    watch_time_hours_28d_num: 0,
                    subs_gained_28d_num: 0,
                    subs_lost_28d_num: 0,
                    subs_net_28d_num: 0,
                    estimated_revenue_28d_num: 0,
                    likes_28d_num: 0,
                    shares_28d_num: 0,
                    has_data: false,
                    last_recorded_at: latest?.recorded_at || null,
                };
            }
        }).sort((a, b) => b.views_28d_num - a.views_28d_num);
    }
    /**
     * Get detailed 28d stats for a single KOC (country + day breakdown)
     */
    static async getKocDetail(kocId) {
        const koc = await database_1.default.kOC.findUnique({
            where: { id: kocId },
            include: {
                channel_stats: {
                    orderBy: { recorded_at: 'desc' },
                    take: 1,
                },
            },
        });
        if (!koc)
            throw new middlewares_1.ApiError(404, 'koc.notFound');
        const latest = koc.channel_stats[0] || null;
        const yt = latest?.yt_analytics;
        const isNewFormat = yt?.byCountry !== undefined;
        return {
            koc_id: koc.id,
            full_name: koc.full_name,
            channel_name: koc.channel_name,
            youtube_channel_id: koc.youtube_channel_id,
            byCountry: isNewFormat ? yt.byCountry : null,
            byDay: isNewFormat ? yt.byDay : null,
            has_data: isNewFormat,
            last_recorded_at: latest?.recorded_at || null,
        };
    }
    /**
     * Get correlation data between views growth and revenue for a KOC
     */
    static async getCorrelation(kocId, months = 6) {
        const koc = await database_1.default.kOC.findUnique({ where: { id: kocId } });
        if (!koc)
            throw new middlewares_1.ApiError(404, 'koc.notFound');
        const records = await database_1.default.revenueRecord.findMany({
            where: { koc_id: kocId },
            include: { cycle: { select: { month: true, exchange_rate: true } } },
            orderBy: { created_at: 'desc' },
            take: months,
        });
        const since = new Date();
        since.setMonth(since.getMonth() - months);
        const stats = await database_1.default.channelStat.findMany({
            where: { koc_id: kocId, recorded_at: { gte: since } },
            orderBy: { recorded_at: 'asc' },
        });
        const statsByMonth = {};
        for (const stat of stats) {
            const date = new Date(stat.recorded_at);
            const monthKey = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            statsByMonth[monthKey] = {
                totalViews: Number(stat.view_count),
                totalSubs: Number(stat.sub_count),
            };
        }
        const correlation = records.reverse().map((record) => ({
            month: record.cycle.month,
            revenue_usd: Number(record.original_revenue_usd),
            koc_receive_usd: Number(record.koc_receive_usd),
            views: statsByMonth[record.cycle.month]?.totalViews || 0,
            subscribers: statsByMonth[record.cycle.month]?.totalSubs || 0,
        }));
        return {
            koc_id: kocId,
            full_name: koc.full_name,
            channel_name: koc.channel_name,
            data: correlation,
        };
    }
}
exports.SocialBladeService = SocialBladeService;
//# sourceMappingURL=socialblade.service.js.map