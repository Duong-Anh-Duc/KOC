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
  static async scrapePubCode(channelId: string, adminId?: string): Promise<string | null> {
    const url = this.buildMonetizationUrl(channelId);
    const cleanId = YouTubeScraperService.cleanChannelId(channelId);
    
    logger.info(`Scraping pub code for channel: ${cleanId}`);

    const context = await YouTubeScraperService.getContext(true, adminId);
    const page = await context.newPage();

    try {
      // Stealth scripts already injected at context level via addInitScript

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (err: any) {
        logger.warn(`Page load timeout for monetization page, continuing...`, err.message);
      }

      // Check login
      if (page.url().includes('accounts.google.com')) {
        throw new Error('NOT_LOGGED_IN');
      }

      // Poll mỗi 10s tối đa 3 phút — AdSense section load lazily
      let text = '';
      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 10000));
        try {
          text = await page.evaluate('document.body.innerText') as string;
        } catch { break; }
        if (/pub-\d{10,20}/.test(text) || text.length >= 5000) break;
        logger.info(`Waiting for monetization page to load (${text.length} chars)...`);
      }

      // Look for pub code pattern: "pub-XXXXXXXXXXXX" (digits after "pub-")
      const pubMatch = text.match(/pub-\d{10,20}/);
      if (pubMatch) {
        logger.info(`Found pub code: ${pubMatch[0]}`);
        return pubMatch[0];
      }

      logger.warn(`No pub code found on monetization page for ${cleanId}`);
      return null;
    } finally {
      try { await page.close(); } catch { /* ignore */ }
    }
  }

  /**
   * Verify pub code for a single KOC
   */
  static async verifyKOCPubCode(kocId: string, adminId?: string): Promise<PubCodeVerificationResult> {
    const koc = await prisma.kOC.findUnique({ where: { id: kocId } });
    if (!koc) throw new Error('KOC not found');

    const cleanChannelId = YouTubeScraperService.cleanChannelId(koc.youtube_channel_id);

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
  static async verifyAllPubCodes(adminId?: string): Promise<{
    results: PubCodeVerificationResult[];
    summary: { total: number; matched: number; mismatched: number; noData: number; errors: number };
  }> {
    const kocs = await prisma.kOC.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, full_name: true, youtube_channel_id: true, pub_code: true },
    });
    return this.checkPubCodesParallel(kocs, adminId);
  }

  /**
   * Mở tất cả tab cùng lúc, navigate song song, extract pub codes
   */
  static async checkPubCodesParallel(
    kocs: Array<{ id: string; full_name: string; youtube_channel_id: string; pub_code: string | null }>,
    adminId?: string,
    onProgress?: (current: number, total: number, name: string) => void,
  ): Promise<{
    results: PubCodeVerificationResult[];
    summary: { total: number; matched: number; mismatched: number; noData: number; errors: number };
  }> {
    const results: PubCodeVerificationResult[] = [];
    const total = kocs.length;
    if (total === 0) return { results, summary: { total: 0, matched: 0, mismatched: 0, noData: 0, errors: 0 } };

    const BATCH_SIZE = 3;
    logger.info(`[PubCode Parallel] Tổng ${total} KOC, mỗi batch ${BATCH_SIZE} tab...`);

    const context = await YouTubeScraperService.getContext(true, adminId);
    let progressCount = 0;

    try {
      for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
        const batchKocs = kocs.slice(batchStart, batchStart + BATCH_SIZE);
        const batchLen = batchKocs.length;
        const pages: any[] = new Array(batchLen).fill(null);

        logger.info(`[PubCode Parallel] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: ${batchLen} tab [${batchKocs.map(k => k.full_name).join(', ')}]`);

        // Bước 1: Mở tab và navigate
        await Promise.all(batchKocs.map(async (koc, i) => {
          const page = await context.newPage();
          pages[i] = page;

          await page.route('**/*', (route: any) => {
            const t = route.request().resourceType();
            if (['image', 'font', 'media', 'stylesheet'].includes(t)) return route.abort();
            return route.continue();
          }).catch(() => {});

          const url = this.buildMonetizationUrl(koc.youtube_channel_id);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch((e: any) => {
            logger.warn(`[PubCode Parallel] Navigate ${koc.full_name} lỗi: ${e.message}`);
          });
          logger.info(`[PubCode Parallel] Tab ${batchStart + i + 1}/${total} đã load: ${koc.full_name}`);
        }));

        await YouTubeScraperService.minimizeWindow(adminId);

        // Bước 2: Poll đến khi pub code xuất hiện
        const POLL_MS = 5000;
        const WAIT_LIMIT = Date.now() + 300000;
        const pageReady = new Array(batchLen).fill(false);

        while (!pageReady.every(Boolean) && Date.now() < WAIT_LIMIT) {
          await new Promise(r => setTimeout(r, POLL_MS));
          for (let i = 0; i < batchLen; i++) {
            if (pageReady[i] || !pages[i]) continue;
            try {
              const text: string = await pages[i].evaluate('document.body.innerText') as string;
              if (/pub-\d{10,20}/.test(text) || text.length >= 5000) {
                pageReady[i] = true;
              }
            } catch { /* vẫn đang load */ }
          }
          const ready = pageReady.filter(Boolean).length;
          logger.info(`[PubCode Parallel] Batch: ${ready}/${batchLen} tab sẵn sàng`);
          if (ready === batchLen) break;
        }

        // Bước 3: Extract và đóng tab
        await Promise.allSettled(pages.map(async (page, i) => {
          const koc = batchKocs[i];
          const cleanId = YouTubeScraperService.cleanChannelId(koc.youtube_channel_id);
          try {
            if (page.url().includes('accounts.google.com')) throw new Error('NOT_LOGGED_IN');

            const text: string = await page.evaluate('document.body.innerText') as string;
            const pubMatch = text.match(/pub-\d{10,20}/);
            const scrapedPubCode = pubMatch ? pubMatch[0] : null;
            const matched = scrapedPubCode && koc.pub_code ? scrapedPubCode === koc.pub_code : null;

            results.push({ kocId: koc.id, channelId: cleanId, kocName: koc.full_name, storedPubCode: koc.pub_code, scrapedPubCode, matched });
            logger.info(`[PubCode Parallel] ${koc.full_name}: ${scrapedPubCode ?? 'không tìm thấy'}`);
          } catch (err: any) {
            results.push({ kocId: koc.id, channelId: cleanId, kocName: koc.full_name, storedPubCode: koc.pub_code, scrapedPubCode: null, matched: null, error: err.message });
            logger.error(`[PubCode Parallel] ${koc.full_name}: ${err.message}`);
          } finally {
            progressCount++;
            if (onProgress) onProgress(progressCount, total, koc.full_name);
            try { await page.close(); } catch { /* ignore */ }
          }
        }));

        // Delay giữa các batch
        if (batchStart + BATCH_SIZE < total) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    } catch (err: any) {
      throw err;
    }

    let matched = 0, mismatched = 0, noData = 0, errors = 0;
    for (const r of results) {
      if (r.error) errors++;
      else if (r.matched === true) matched++;
      else if (r.matched === false) mismatched++;
      else noData++;
    }

    logger.info(`[PubCode Parallel] Hoàn tất: ${matched} khớp, ${mismatched} sai, ${noData} không có, ${errors} lỗi`);
    return { results, summary: { total, matched, mismatched, noData, errors } };
  }
}
