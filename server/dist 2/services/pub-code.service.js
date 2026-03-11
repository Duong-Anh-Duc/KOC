"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PubCodeService = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
const youtube_scraper_service_1 = require("./youtube-scraper.service");
class PubCodeService {
    /**
     * Build the monetization overview URL for a channel
     */
    static buildMonetizationUrl(channelId) {
        const cleanId = youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(channelId);
        return `https://studio.youtube.com/channel/${cleanId}/monetization/overview?c=${cleanId}`;
    }
    /**
     * Scrape the pub code from YouTube Studio monetization page
     * Looks for pattern: "pub-XXXXXXXXXXXXX"
     */
    static async scrapePubCode(channelId, adminId) {
        const url = this.buildMonetizationUrl(channelId);
        const cleanId = youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(channelId);
        logger_middleware_1.default.info(`🔍 Scraping pub code for channel: ${cleanId}`);
        const context = await youtube_scraper_service_1.YouTubeScraperService.getContext(true, adminId);
        const page = await context.newPage();
        try {
            // Stealth scripts already injected at context level via addInitScript
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            }
            catch (err) {
                logger_middleware_1.default.warn(`⚠️ Page load timeout for monetization page, continuing...`, err.message);
            }
            // Check login
            if (page.url().includes('accounts.google.com')) {
                throw new Error('NOT_LOGGED_IN');
            }
            // Wait for page to render
            await new Promise(r => setTimeout(r, 5000));
            // Extract text from the page
            const text = await Promise.race([
                page.evaluate('document.body.innerText'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout extracting text')), 30000)),
            ]);
            // Look for pub code pattern: "pub-XXXXXXXXXXXX" (digits after "pub-")
            const pubMatch = text.match(/pub-\d{10,20}/);
            if (pubMatch) {
                logger_middleware_1.default.info(`✓ Found pub code: ${pubMatch[0]}`);
                return pubMatch[0];
            }
            logger_middleware_1.default.warn(`⚠️ No pub code found on monetization page for ${cleanId}`);
            return null;
        }
        finally {
            try {
                await page.close();
            }
            catch { /* ignore */ }
        }
    }
    /**
     * Verify pub code for a single KOC
     */
    static async verifyKOCPubCode(kocId, adminId) {
        const koc = await database_1.default.kOC.findUnique({ where: { id: kocId } });
        if (!koc)
            throw new Error('KOC not found');
        const cleanChannelId = youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(koc.youtube_channel_id);
        try {
            const scrapedPubCode = await this.scrapePubCode(koc.youtube_channel_id, adminId);
            const matched = scrapedPubCode && koc.pub_code
                ? scrapedPubCode === koc.pub_code
                : null;
            return {
                kocId: koc.id,
                channelId: cleanChannelId,
                kocName: koc.full_name,
                storedPubCode: koc.pub_code,
                scrapedPubCode,
                matched,
            };
        }
        catch (error) {
            return {
                kocId: koc.id,
                channelId: cleanChannelId,
                kocName: koc.full_name,
                storedPubCode: koc.pub_code,
                scrapedPubCode: null,
                matched: null,
                error: error.message,
            };
        }
    }
    /**
     * Verify pub codes for all active KOCs
     */
    static async verifyAllPubCodes(adminId) {
        const kocs = await database_1.default.kOC.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, full_name: true, youtube_channel_id: true, pub_code: true },
        });
        const results = [];
        let matched = 0, mismatched = 0, noData = 0, errors = 0;
        for (const koc of kocs) {
            try {
                const result = await this.verifyKOCPubCode(koc.id, adminId);
                results.push(result);
                if (result.error) {
                    errors++;
                }
                else if (result.matched === true) {
                    matched++;
                }
                else if (result.matched === false) {
                    mismatched++;
                }
                else {
                    noData++;
                }
                // Small delay between requests
                await new Promise(r => setTimeout(r, 2000));
            }
            catch (error) {
                results.push({
                    kocId: koc.id,
                    channelId: youtube_scraper_service_1.YouTubeScraperService.cleanChannelId(koc.youtube_channel_id),
                    kocName: koc.full_name,
                    storedPubCode: koc.pub_code,
                    scrapedPubCode: null,
                    matched: null,
                    error: error.message,
                });
                errors++;
            }
        }
        return {
            results,
            summary: { total: kocs.length, matched, mismatched, noData, errors },
        };
    }
}
exports.PubCodeService = PubCodeService;
//# sourceMappingURL=pub-code.service.js.map