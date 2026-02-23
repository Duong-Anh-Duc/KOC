import { TFunction } from 'i18next';

/**
 * Parses and translates cron job result messages
 * @param message The raw message from the cron job
 * @param t Translation function from i18next
 * @returns Translated message
 */
export function formatCronResult(message: string, t: TFunction): string {
  if (!message) return '';

  // Pattern 1: "Cycle created. Scraped X channels: Y records created/updated, Z skipped, W errors"
  const cycleCreatedWithScrapeMatch = message.match(
    /^Cycle created\. Scraped (\d+) channels?: (\d+) records? created\/updated, (\d+) skipped, (\d+) errors?$/
  );
  if (cycleCreatedWithScrapeMatch) {
    return t('cron.results.cycleCreatedWithScrape', {
      count: parseInt(cycleCreatedWithScrapeMatch[1], 10),
      created: parseInt(cycleCreatedWithScrapeMatch[2], 10),
      skipped: parseInt(cycleCreatedWithScrapeMatch[3], 10),
      errors: parseInt(cycleCreatedWithScrapeMatch[4], 10),
    });
  }

  // Pattern 2: "Scraped X channels: Y records created/updated, Z skipped, W errors"
  const scrapedChannelsMatch = message.match(
    /^Scraped (\d+) channels?: (\d+) records? created\/updated, (\d+) skipped, (\d+) errors?$/
  );
  if (scrapedChannelsMatch) {
    return t('cron.results.scrapedChannels', {
      count: parseInt(scrapedChannelsMatch[1], 10),
      created: parseInt(scrapedChannelsMatch[2], 10),
      skipped: parseInt(scrapedChannelsMatch[3], 10),
      errors: parseInt(scrapedChannelsMatch[4], 10),
    });
  }

  // Pattern 3: "Cycle XX/YYYY is not OPEN (status: STATUS), skipping scrape"
  const cycleNotOpenMatch = message.match(
    /^Cycle ([^.]+?) is not OPEN \(status: ([^)]+)\), skipping scrape$/
  );
  if (cycleNotOpenMatch) {
    return t('cron.results.cycleNotOpen', {
      month: cycleNotOpenMatch[1],
      status: cycleNotOpenMatch[2],
    });
  }

  // Pattern 4: "Cycle created. Cycle XX/YYYY is not OPEN..."
  const cycleCreatedNotOpenMatch = message.match(
    /^Cycle created\. Cycle ([^.]+?) is not OPEN \(status: ([^)]+)\), skipping scrape$/
  );
  if (cycleCreatedNotOpenMatch) {
    return `${t('cron.results.cycleCreated')} ${t('cron.results.cycleNotOpen', {
      month: cycleCreatedNotOpenMatch[1],
      status: cycleCreatedNotOpenMatch[2],
    })}`;
  }

  // Pattern 5: "No active KOCs found for scraping"
  if (message.includes('No active KOCs found for scraping')) {
    return t('cron.results.noActiveKOCs');
  }

  // Pattern 6: "Cycle created. No active KOCs..."
  if (message.includes('Cycle created. No active KOCs found for scraping')) {
    return `${t('cron.results.cycleCreated')} ${t('cron.results.noActiveKOCs')}`;
  }

  // Pattern 7: "scrape failed: ..."
  const scrapeFailedMatch = message.match(/^scrape failed: (.+)$/i);
  if (scrapeFailedMatch) {
    return t('cron.results.scrapeFailed', { error: scrapeFailedMatch[1] });
  }

  // Pattern 8: "Cycle created but scrape failed: ..."
  const cycleCreatedScrapeFailedMatch = message.match(/^Cycle created but scrape failed: (.+)$/);
  if (cycleCreatedScrapeFailedMatch) {
    return t('cron.results.cycleCreatedScrapeFailed', { error: cycleCreatedScrapeFailedMatch[1] });
  }

  // Pattern 9: "Cycle (created|already exists) for XX/YYYY. Auto-scrape disabled."
  const cycleExistsMatch = message.match(/^Cycle (created|already exists) for ([^.]+)\. Auto-scrape disabled\.$/);
  if (cycleExistsMatch) {
    return t('cron.results.cycleExists', {
      status: cycleExistsMatch[1] === 'created' ? t('cron.results.cycleCreated').toLowerCase() : t('audit.actions.UPDATE').toLowerCase(),
      month: cycleExistsMatch[2],
    });
  }

  // Pattern 10: "Job failed: ..."
  const jobFailedMatch = message.match(/^Job failed: (.+)$/);
  if (jobFailedMatch) {
    return t('cron.results.jobFailed', { error: jobFailedMatch[1] });
  }

  // Pattern 11: "Cannot create cycle for XX/YYYY: the month has not ended yet"
  const cannotCreateCycleMatch = message.match(/^Cannot create cycle for ([^:]+): the month has not ended yet$/);
  if (cannotCreateCycleMatch) {
    return t('cron.results.cannotCreateCycle', { month: cannotCreateCycleMatch[1] });
  }

  // Pattern 12: "Cannot create cycle for XX/YYYY: the month is in the future"
  const cannotCreateCycleFutureMatch = message.match(/^Cannot create cycle for ([^:]+): the month is in the future$/);
  if (cannotCreateCycleFutureMatch) {
    return t('cron.results.cannotCreateCycleFuture', { month: cannotCreateCycleFutureMatch[1] });
  }

  // If no pattern matches, return the original message
  return message;
}
