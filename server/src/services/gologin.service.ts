import { execFile } from 'child_process';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import logger from '../middlewares/logger.middleware';

/**
 * GoLoginService — launch Orbita anti-detect browser cục bộ, không cần API token.
 *
 * Cách hoạt động:
 *   1. `start()` → tìm Orbita browser (đã tải qua GoLogin desktop app),
 *      launch với --remote-debugging-port, set CHROME_CDP_URL.
 *   2. YouTubeScraperService.getContext() tự dùng CDP URL → không cần sửa code cũ.
 *   3. `stop()` → kill process, xoá CHROME_CDP_URL.
 *
 * Không cần:
 *   - GOLOGIN_API_TOKEN
 *   - GOLOGIN_PROFILE_ID
 *   - Kết nối internet
 *
 * Tuỳ chọn .env:
 *   GOLOGIN_CDP_PORT   — remote debugging port (mặc định: 9223)
 *   GOLOGIN_PROFILE_DIR — thư mục profile Orbita (mặc định: ~/.gologin/local-profiles/default)
 *   GOLOGIN_HEADLESS   — "true" để chạy ẩn (mặc định: false)
 */
export class GoLoginService {
  private static orbitaProcess: ReturnType<typeof execFile> | null = null;
  private static wsUrl: string | null = null;
  private static running = false;
  private static cdpPort: number = 9223;

  // ─── Tìm Orbita browser ───────────────────────────────────────────────────

  static getOrbitaExecutablePath(): string | null {
    const browserDir = join(homedir(), '.gologin', 'browser');
    if (!existsSync(browserDir)) return null;

    try {
      const entries = readdirSync(browserDir)
        .filter(d => d.startsWith('orbita-browser-') && !d.endsWith('.tar.gz') && !d.endsWith('.zip'))
        .sort()
        .reverse(); // latest first

      for (const entry of entries) {
        // macOS
        const macPath = join(browserDir, entry, 'Orbita-Browser.app', 'Contents', 'MacOS', 'Orbita');
        if (existsSync(macPath)) return macPath;
        // Linux
        const linPath = join(browserDir, entry, 'chrome');
        if (existsSync(linPath)) return linPath;
        // Windows
        const winPath = join(browserDir, entry, 'chrome.exe');
        if (existsSync(winPath)) return winPath;
      }
    } catch {
      // ignore
    }
    return null;
  }

  // ─── start ────────────────────────────────────────────────────────────────

  static async start(): Promise<{ wsUrl: string }> {
    if (this.running) {
      throw new Error('GoLogin (Orbita) đang chạy. Dừng lại trước khi start mới.');
    }

    const orbitaPath = this.getOrbitaExecutablePath();
    if (!orbitaPath) {
      throw new Error(
        'Không tìm thấy Orbita browser. Hãy mở GoLogin desktop app để tải Orbita xuống (~/.gologin/browser/).',
      );
    }

    const cdpPort = parseInt(process.env.GOLOGIN_CDP_PORT ?? '9223', 10);
    this.cdpPort = cdpPort;

    const profileDir =
      process.env.GOLOGIN_PROFILE_DIR ??
      join(homedir(), '.gologin', 'local-profiles', 'default');

    if (!existsSync(profileDir)) {
      mkdirSync(profileDir, { recursive: true });
      logger.info(`[GoLogin] Tạo profile dir: ${profileDir}`);
    }

    const headless = process.env.GOLOGIN_HEADLESS === 'true';

    const args = [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-default-apps',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--safebrowsing-disable-auto-update',
      '--password-store=basic',
      '--use-mock-keychain',
      ...(headless ? ['--headless=new', '--disable-gpu'] : []),
    ];

    logger.info(`[GoLogin] Khởi động Orbita: ${orbitaPath} (port=${cdpPort}, headless=${headless})`);

    await new Promise<void>((resolve, reject) => {
      this.orbitaProcess = execFile(orbitaPath, args, { env: process.env });

      this.orbitaProcess.on('error', (err) => {
        this.orbitaProcess = null;
        reject(new Error(`Không thể khởi động Orbita: ${err.message}`));
      });

      // Đợi browser lắng nghe CDP (thử poll /json/version)
      this._waitForCDP(cdpPort, 15000).then(resolve).catch(reject);
    });

    const cdpUrl = `http://localhost:${cdpPort}`;
    const wsUrl = await this._getCDPWebsocketUrl(cdpUrl);

    this.wsUrl = wsUrl;
    this.running = true;

    // Inject → YouTubeScraperService tự dùng
    process.env.CHROME_CDP_URL = cdpUrl;

    // Xoá context cũ để force reconnect
    try {
      const { YouTubeScraperService } = await import('./youtube-scraper.service');
      await YouTubeScraperService.closeBrowser();
    } catch {
      // ignore
    }

    logger.info(`[GoLogin] Orbita đã khởi động. CDP: ${cdpUrl}  WS: ${wsUrl}`);
    return { wsUrl };
  }

  // ─── stop ─────────────────────────────────────────────────────────────────

  static async stop(): Promise<void> {
    if (!this.running) {
      throw new Error('Không có GoLogin (Orbita) nào đang chạy');
    }

    // Đóng context Playwright trước
    try {
      const { YouTubeScraperService } = await import('./youtube-scraper.service');
      await YouTubeScraperService.closeBrowser();
    } catch {
      // ignore
    }

    if (this.orbitaProcess) {
      try {
        this.orbitaProcess.kill('SIGTERM');
      } catch {
        // ignore
      }
      this.orbitaProcess = null;
    }

    const cdpUrl = `http://localhost:${this.cdpPort}`;
    if (process.env.CHROME_CDP_URL === cdpUrl) {
      process.env.CHROME_CDP_URL = '';
    }

    this.wsUrl = null;
    this.running = false;
    logger.info(`[GoLogin] Orbita đã dừng`);
  }

  // ─── status ───────────────────────────────────────────────────────────────

  static getStatus() {
    const cdpUrl = `http://localhost:${this.cdpPort}`;
    return {
      isRunning: this.running,
      profileId: null,
      wsUrl: this.wsUrl,
      cdpInjected: this.running && process.env.CHROME_CDP_URL === cdpUrl,
      orbitaPath: this.getOrbitaExecutablePath(),
    };
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  /** Poll CDP /json/version cho đến khi browser sẵn sàng */
  private static _waitForCDP(port: number, timeoutMs: number): Promise<void> {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const check = () => {
        const http = require('http') as typeof import('http');
        const req = http.get(`http://localhost:${port}/json/version`, (res) => {
          res.resume();
          if (res.statusCode === 200) return resolve();
          retry();
        });
        req.on('error', retry);
        req.setTimeout(1000, () => { req.destroy(); retry(); });
      };
      const retry = () => {
        if (Date.now() - started > timeoutMs) {
          return reject(new Error(`Orbita browser không phản hồi sau ${timeoutMs}ms`));
        }
        setTimeout(check, 500);
      };
      check();
    });
  }

  /** Lấy WebSocket URL từ CDP /json/version */
  private static _getCDPWebsocketUrl(cdpUrl: string): Promise<string> {
    const http = require('http') as typeof import('http');
    return new Promise((resolve, reject) => {
      http.get(`${cdpUrl}/json/version`, (res) => {
        let data = '';
        res.on('data', (c: string) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.webSocketDebuggerUrl ?? cdpUrl);
          } catch {
            resolve(cdpUrl);
          }
        });
      }).on('error', () => resolve(cdpUrl));
    });
  }
}
