import prisma from '../config/database';
import logger from '../middlewares/logger.middleware';
import { YouTubeScraperService } from './youtube-scraper.service';

export interface PubCodeVerificationResult {
  kocId: string;
  channelId: string;
  kocName: string;
  storedPubCode: string | null;
  scrapedPubCode: string | null;
  matched: boolean | null; // null if could not scrape
  error?: string;
}

export class PubCodeService {
  /**
   * Build the monetization overview URL for a channel
   */
  static buildMonetizationUrl(channelId: string): string {
    const cleanId = YouTubeScraperService.cleanChannelId(channelId);
    return `https://studio.youtube.com/channel/${cleanId}/monetization/overview?c=${cleanId}`;
  }

  /**
   * Scrape the pub code from YouTube Studio monetization page
   * Looks for pattern: "pub-XXXXXXXXXXXXX"
   */
  static async scrapePubCode(channelId: string): Promise<string | null> {
    const url = this.buildMonetizationUrl(channelId);
    const cleanId = YouTubeScraperService.cleanChannelId(channelId);
    
    logger.info(`🔍 Scraping pub code for channel: ${cleanId}`);

    const browser = await YouTubeScraperService.getBrowser();
    const page = await browser.newPage();

    try {
      // Apply stealth
      await page.evaluateOnNewDocument(`
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      `);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (err: any) {
        logger.warn(`⚠️ Page load timeout for monetization page, continuing...`, err.message);
      }

      // Check login
      if (page.url().includes('accounts.google.com')) {
        throw new Error('NOT_LOGGED_IN');
      }

      // Wait for page to render
      await new Promise(r => setTimeout(r, 5000));

      // Extract text from the page
      const text = await Promise.race([
        page.evaluate('document.body.innerText') as Promise<string>,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout extracting text')), 30000)
        ),
      ]);

      // Look for pub code pattern: "pub-XXXXXXXXXXXX" (digits after "pub-")
      const pubMatch = text.match(/pub-\d{10,20}/);
      if (pubMatch) {
        logger.info(`✓ Found pub code: ${pubMatch[0]}`);
        return pubMatch[0];
      }

      logger.warn(`⚠️ No pub code found on monetization page for ${cleanId}`);
      return null;
    } finally {
      try { await page.close(); } catch { /* ignore */ }
    }
  }

  /**
   * Verify pub code for a single KOC
   */
  static async verifyKOCPubCode(kocId: string): Promise<PubCodeVerificationResult> {
    const koc = await prisma.kOC.findUnique({ where: { id: kocId } });
    if (!koc) throw new Error('KOC not found');

    const cleanChannelId = YouTubeScraperService.cleanChannelId(koc.youtube_channel_id);

    try {
      const scrapedPubCode = await this.scrapePubCode(koc.youtube_channel_id);

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
    } catch (error: any) {
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
  static async verifyAllPubCodes(): Promise<{
    results: PubCodeVerificationResult[];
    summary: { total: number; matched: number; mismatched: number; noData: number; errors: number };
  }> {
    const kocs = await prisma.kOC.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, full_name: true, youtube_channel_id: true, pub_code: true },
    });

    const results: PubCodeVerificationResult[] = [];
    let matched = 0, mismatched = 0, noData = 0, errors = 0;

    for (const koc of kocs) {
      try {
        const result = await this.verifyKOCPubCode(koc.id);
        results.push(result);

        if (result.error) {
          errors++;
        } else if (result.matched === true) {
          matched++;
        } else if (result.matched === false) {
          mismatched++;
        } else {
          noData++;
        }

        // Small delay between requests
        await new Promise(r => setTimeout(r, 2000));
      } catch (error: any) {
        results.push({
          kocId: koc.id,
          channelId: YouTubeScraperService.cleanChannelId(koc.youtube_channel_id),
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
