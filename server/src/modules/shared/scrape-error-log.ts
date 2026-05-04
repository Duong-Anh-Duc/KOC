import fs from 'fs';
import path from 'path';

/**
 * Log lỗi scrape vào file riêng trong logs/scrape-errors/<YYYY-MM-DD>.log
 * Tách khỏi winston để dễ tra cứu — 1 file/ngày, không lẫn với log API/DB.
 *
 * Format: [timestamp] [scope] target: message
 *   scope: '28d-stats', 'monthly-revenue', 'pub-code', 'revenue', ...
 *   target: KOC name / channel ID / batch info
 */
export function logScrapeError(scope: string, target: string, error: unknown): void {
  try {
    const dir = path.join(process.cwd(), 'logs', 'scrape-errors');
    fs.mkdirSync(dir, { recursive: true });
    const today = new Date().toISOString().substring(0, 10);
    const file = path.join(dir, `${today}.log`);
    const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);

    let msg: string;
    if (error instanceof Error) msg = `${error.message}\n${error.stack || ''}`;
    else if (typeof error === 'string') msg = error;
    else msg = JSON.stringify(error);

    const line = `[${ts}] [${scope}] ${target}: ${msg}\n${'-'.repeat(80)}\n`;
    fs.appendFileSync(file, line);
  } catch { /* ignore — logging không được crash app */ }
}
