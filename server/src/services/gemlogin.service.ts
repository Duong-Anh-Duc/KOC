import net from 'net';
import logger from '../middlewares/logger.middleware';

/**
 * GemLoginService — tích hợp GemLogin anti-detect browser qua HTTP API.
 *
 * GemLogin chạy local trên máy, expose REST API (mặc định: http://localhost:7003).
 * Service này wrap các endpoint chính và tự inject CHROME_CDP_URL khi start profile
 * để YouTubeScraperService tự dùng được qua CDP.
 *
 * Cấu hình .env:
 *   GEMLOGIN_API_URL   — base URL của GemLogin API (mặc định: http://localhost:7003)
 *   GEMLOGIN_PROFILE_ID — profile ID mặc định để start (tuỳ chọn)
 */

const DEFAULT_API_URL = 'http://localhost:7003';

function getApiUrl(): string {
  return (process.env.GEMLOGIN_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
}

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 30_000): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, opts);
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GemLogin API ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`GemLogin API ${method} ${path} → timeout sau ${timeoutMs / 1000}s`);
    }
    throw err;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrowserVersion {
  id: string;
  name: string;
  version: string;
}

export interface Group {
  id: string;
  name: string;
}

export interface Profile {
  id: string;
  name: string;
  browserVersion?: string;
  proxy?: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
  fingerprint?: string;
  timezone?: string;
  [key: string]: unknown;
}

export interface CreateProfilePayload {
  name: string;
  browserVersion?: string;
  proxy?: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
  fingerprint?: string;
  timezone?: string;
}

export interface StartProfileResult {
  wsUrl: string;
  cdpUrl: string;
  profileId: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class GemLoginService {
  /** ID của profile đang được quản lý bởi service (nếu có) */
  private static activeProfileId: string | null = null;
  private static running = false;

  // ── Browser Versions ──────────────────────────────────────────────────────

  static getBrowserVersions(): Promise<BrowserVersion[]> {
    return request<BrowserVersion[]>('GET', '/api/browser_versions');
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  static getGroups(): Promise<Group[]> {
    return request<Group[]>('GET', '/api/groups');
  }

  // ── Profiles ──────────────────────────────────────────────────────────────

  static getProfiles(): Promise<Profile[]> {
    return request<Profile[]>('GET', '/api/profiles');
  }

  static getProfile(id: string): Promise<Profile> {
    return request<Profile>('GET', `/api/profile/${id}`);
  }

  static createProfile(payload: CreateProfilePayload): Promise<Profile> {
    return request<Profile>('POST', '/api/profiles/create', payload);
  }

  static updateProfile(profileId: string, payload: Partial<CreateProfilePayload>): Promise<Profile> {
    return request<Profile>('POST', `/api/profiles/update/${profileId}`, payload);
  }

  static deleteProfile(id: string): Promise<unknown> {
    return request<unknown>('GET', `/api/profiles/delete/${id}`);
  }

  static changeFingerprint(ids?: string[]): Promise<unknown> {
    const query = ids?.length ? `?ids=${ids.join(',')}` : '';
    return request<unknown>('GET', `/api/profiles/changeFingerprint${query}`);
  }

  // ── Start / Close browser ─────────────────────────────────────────────────

  /**
   * Khởi động browser instance cho profile, inject CHROME_CDP_URL để
   * YouTubeScraperService tự dùng qua CDP.
   *
   * GemLogin giữ HTTP connection open trong suốt phiên browser → không bao giờ trả response.
   * Giải pháp: fire-and-forget start API, rồi tự scan CDP port.
   */
  /**
   * Detect if running inside Docker (container can't reach host via 127.0.0.1).
   * When in Docker, use host.docker.internal to reach the Windows/Mac host.
   */
  private static isDocker(): boolean {
    return !!process.env.GEMLOGIN_API_URL?.includes('host.docker.internal');
  }

  /**
   * Replace 127.0.0.1 with host.docker.internal when running in Docker.
   */
  private static resolveHost(address: string): string {
    if (this.isDocker()) {
      return address.replace(/127\.0\.0\.1|localhost/g, 'host.docker.internal');
    }
    return address;
  }

  /**
   * CDP Relay ports — relay chạy trên Windows host (node cdp-relay.js).
   * RELAY_CDP_PORT: TCP proxy port, Docker container kết nối CDP qua đây.
   * RELAY_CONTROL_PORT: HTTP API port, backend gọi /set?port=XXXX để cập nhật target.
   */
  private static readonly RELAY_CDP_PORT = 19222;
  private static readonly RELAY_CONTROL_PORT = 19223;

  /**
   * Gọi CDP Relay control API để cập nhật target port.
   * Relay chạy trên Windows host, listen 0.0.0.0:19223.
   */
  private static async setRelayTarget(port: number): Promise<boolean> {
    const relayUrl = `http://host.docker.internal:${this.RELAY_CONTROL_PORT}/set?port=${port}`;
    try {
      const res = await fetch(relayUrl, { method: 'POST', signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        logger.info(`[GemLogin] Relay target cập nhật: 127.0.0.1:${port}`);
        return true;
      }
      logger.warn(`[GemLogin] Relay trả về ${res.status}`);
      return false;
    } catch (err: any) {
      logger.warn(`[GemLogin] Không thể kết nối Relay: ${err.message}. Đảm bảo đã chạy "node cdp-relay.js" trên Windows.`);
      return false;
    }
  }

  /**
   * Trích xuất port từ remote_debugging_address (ví dụ: "127.0.0.1:53624" → 53624).
   */
  private static extractPort(addr: string): number {
    const match = addr.match(/:(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  static async startProfile(profileId: string): Promise<StartProfileResult> {
    if (this.running) {
      throw new Error(`GemLogin đang chạy profile "${this.activeProfileId}". Đóng trước khi start mới.`);
    }

    const inDocker = this.isDocker();

    // Kiểm tra CDP đã sẵn sàng chưa (browser đang chạy từ trước)
    logger.info('[GemLogin] Kiểm tra CDP đã sẵn sàng chưa (browser có thể đang chạy)...');
    let cdpUrl = await GemLoginService.discoverCdp(5_000).catch(() => null);

    if (cdpUrl) {
      logger.info(`[GemLogin] CDP đã sẵn sàng: ${cdpUrl} — bỏ qua bước mở browser`);
    } else {
      // Browser chưa chạy — gọi GemLogin API để mở browser
      logger.info(`[GemLogin] Gửi lệnh khởi động profile: ${profileId}`);

      // Trong Docker: đợi response để lấy remote_debugging_address, rồi dùng relay
      // Ngoài Docker: fire-and-forget rồi scan port
      if (inDocker) {
        try {
          const raw = await request<any>('GET', `/api/profiles/start/${profileId}`, undefined, 300_000);
          logger.info(`[GemLogin] Start API trả về: ${JSON.stringify(raw)}`);
          const addr: string = raw?.data?.remote_debugging_address || raw?.remote_debugging_address || '';
          if (addr) {
            const chromePort = this.extractPort(addr);
            logger.info(`[GemLogin] Chrome CDP port: ${chromePort}`);

            if (chromePort > 0) {
              // Gọi relay control API để cập nhật target port
              const relayOk = await this.setRelayTarget(chromePort);
              if (relayOk) {
                // Dùng relay fixed port làm CDP URL
                const relayUrl = `http://host.docker.internal:${this.RELAY_CDP_PORT}`;
                logger.info(`[GemLogin] Thử kết nối qua relay: ${relayUrl}`);
                const deadline = Date.now() + 30_000;
                while (Date.now() < deadline) {
                  try {
                    const r = await fetch(`${relayUrl}/json/version`, { signal: AbortSignal.timeout(2000) });
                    if (r.ok) { cdpUrl = relayUrl; break; }
                  } catch { /* relay chưa sẵn sàng */ }
                  await new Promise(r => setTimeout(r, 2000));
                }
                if (cdpUrl) {
                  logger.info(`[GemLogin] Kết nối qua relay thành công: ${cdpUrl}`);
                } else {
                  logger.warn('[GemLogin] Relay không trả lời CDP — kiểm tra cdp-relay.js');
                }
              }
            }

            // Fallback: thử kết nối trực tiếp qua host.docker.internal (nếu relay không hoạt động)
            if (!cdpUrl) {
              const resolved = this.resolveHost(addr);
              const testUrl = `http://${resolved}`;
              logger.info(`[GemLogin] Fallback: thử trực tiếp ${testUrl}`);
              const deadline = Date.now() + 15_000;
              while (Date.now() < deadline) {
                try {
                  const r = await fetch(`${testUrl}/json/version`, { signal: AbortSignal.timeout(2000) });
                  if (r.ok) { cdpUrl = testUrl; break; }
                } catch { /* chưa sẵn sàng */ }
                await new Promise(r => setTimeout(r, 2000));
              }
            }
          }
        } catch (err: any) {
          logger.warn(`[GemLogin] Start API lỗi: ${err.message}`);
        }

        // Fallback cuối: scan qua host.docker.internal
        if (!cdpUrl) {
          logger.info('[GemLogin] Fallback cuối: scanning CDP trên host.docker.internal...');
          cdpUrl = await GemLoginService.discoverCdp(60_000);
        }
      } else {
        // Ngoài Docker: fire-and-forget + scan port như cũ
        request<unknown>('GET', `/api/profiles/start/${profileId}`, undefined, 300_000)
          .then(raw => logger.info(`[GemLogin] Start API cuối cùng đã trả về: ${JSON.stringify(raw)}`))
          .catch(err => logger.info(`[GemLogin] Start API kết thúc: ${err.message}`));

        await new Promise(r => setTimeout(r, 2000));

        logger.info('[GemLogin] Scanning CDP port...');
        cdpUrl = await GemLoginService.discoverCdp(90_000);
      }
    }

    if (!cdpUrl) {
      throw new Error('[GemLogin] Không tìm thấy CDP port. Nếu chạy Docker, đảm bảo đã chạy "node cdp-relay.js" trên Windows host.');
    }

    this.activeProfileId = profileId;
    this.running = true;
    process.env.CHROME_CDP_URL = cdpUrl;

    try {
      const { YouTubeScraperService } = await import('./youtube-scraper.service');
      await YouTubeScraperService.closeBrowser();
    } catch { /* ignore */ }

    logger.info(`[GemLogin] Profile ${profileId} sẵn sàng. CDP: ${cdpUrl}`);
    return { wsUrl: cdpUrl, cdpUrl, profileId };
  }

  /**
   * Scan tất cả port 1024–65000 trên CẢ IPv4 (127.0.0.1) VÀ IPv6 (::1).
   * GemLogin có thể bind Chrome CDP trên ::1 (IPv6 localhost) thay vì 127.0.0.1.
   * TCP check: ECONNREFUSED về ngay (<1ms) → scan 64K port chỉ mất ~1-2s.
   */
  private static async discoverCdp(timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    // Bỏ qua port của chính server để tránh spam log
    const OWN_PORT = parseInt(process.env.PORT || '3001', 10);

    const tcpOpen = (host: string, port: number): Promise<boolean> =>
      new Promise(resolve => {
        const s = net.createConnection({ host, port });
        const t = setTimeout(() => { s.destroy(); resolve(false); }, 80);
        s.on('connect', () => { clearTimeout(t); s.destroy(); resolve(true); });
        s.on('error', () => { clearTimeout(t); resolve(false); });
      });

    const cdpCheck = async (host: string, port: number): Promise<string | null> => {
      const h = host.includes(':') ? `[${host}]` : host; // IPv6 cần dấu []
      try {
        const r = await fetch(`http://${h}:${port}/json/version`, {
          signal: AbortSignal.timeout(500),
        });
        if (r.ok) {
          const j = await r.json() as any;
          if (j?.Browser) return `http://${h}:${port}`;
        }
      } catch { /* not CDP */ }
      return null;
    };

    // Khi chạy trong Docker, kiểm tra relay port trước (nhanh hơn full scan)
    if (this.isDocker()) {
      const relayUrl = await cdpCheck('host.docker.internal', this.RELAY_CDP_PORT);
      if (relayUrl) {
        logger.info(`[GemLogin] CDP found qua relay: ${relayUrl}`);
        return relayUrl;
      }
    }

    // Khi chạy trong Docker, scan host.docker.internal (Windows/Mac host)
    const scanHosts = this.isDocker() ? ['host.docker.internal'] : ['127.0.0.1', '::1'];

    while (Date.now() < deadline) {
      for (const host of scanHosts) {
        // TCP scan 1024–65000 (batch 2000 song song)
        const openPorts: number[] = [];
        for (let start = 1024; start <= 65000 && Date.now() < deadline; start += 2000) {
          const batch = Array.from({ length: Math.min(2000, 65001 - start) }, (_, i) => start + i);
          const hits = await Promise.all(batch.map(async p => (await tcpOpen(host, p)) ? p : null));
          openPorts.push(...hits.filter((p): p is number => p !== null));
        }
        const display = openPorts.filter(p => p !== OWN_PORT);
        logger.info(`[GemLogin] ${host}: ${openPorts.length} port mở: [${display.slice(0, 30).join(', ')}${display.length > 30 ? '...' : ''}]`);

        // HTTP-check từng port mở (bỏ qua port server của mình)
        for (const port of openPorts.filter(p => p !== OWN_PORT)) {
          const url = await cdpCheck(host, port);
          if (url) {
            logger.info(`[GemLogin] CDP found: ${url}`);
            return url;
          }
        }
      }

      const timeLeft = Math.round((deadline - Date.now()) / 1000);
      logger.info(`[GemLogin] CDP không tìm thấy trên IPv4/IPv6, thử lại sau 3s (còn ${timeLeft}s)...`);
      await new Promise(r => setTimeout(r, 3000));
    }

    throw new Error('[GemLogin] Không tìm thấy CDP port sau full scan. Đảm bảo GemLogin đã mở browser với remote debugging.');
  }

  /**
   * Đóng browser instance đang chạy và xoá CHROME_CDP_URL.
   */
  static async closeProfile(profileId?: string): Promise<void> {
    const id = profileId || this.activeProfileId;
    if (!id) {
      throw new Error('Không có profile nào đang chạy');
    }

    logger.info(`[GemLogin] Đóng profile: ${id}`);

    // Đóng Playwright context trước
    try {
      const { YouTubeScraperService } = await import('./youtube-scraper.service');
      await YouTubeScraperService.closeBrowser();
    } catch {
      // ignore
    }

    await request<unknown>('GET', `/api/profiles/close/${id}`);

    if (this.activeProfileId === id) {
      process.env.CHROME_CDP_URL = '';
      this.activeProfileId = null;
      this.running = false;
    }

    logger.info(`[GemLogin] Profile ${id} đã đóng`);
  }

  // ── Reconnect (khi CDP bị mất giữa chừng) ────────────────────────────────

  /**
   * Gọi lại /api/profiles/start/{id} để lấy CDP port mới và inject lại.
   * Dùng khi browser bị đóng/crash trong lúc đang cào.
   */
  static async reconnect(): Promise<string> {
    const profileId = this.activeProfileId;
    if (!profileId) throw new Error('[GemLogin] Không có profile active để reconnect');

    logger.info(`[GemLogin] Reconnect profile ${profileId} — scan CDP port...`);

    // Browser vẫn đang chạy, chỉ cần scan lại để lấy port mới
    const cdpUrl = await GemLoginService.discoverCdp(60_000);
    process.env.CHROME_CDP_URL = cdpUrl;

    // Xoá context cũ để Playwright reconnect với port mới
    try {
      const { YouTubeScraperService } = await import('./youtube-scraper.service');
      await YouTubeScraperService.closeBrowser();
    } catch { /* ignore */ }

    logger.info(`[GemLogin] Reconnected. CDP mới: ${cdpUrl}`);
    return cdpUrl;
  }

  /**
   * Đảm bảo GemLogin đang chạy trước khi cào.
   * Nếu chưa chạy → tự start profile mặc định.
   * Dùng cho tất cả các flow cào (monthly, stats, revenue).
   */
  static async ensureRunning(onStarting?: () => void): Promise<void> {
    if (this.running) return;
    onStarting?.();
    const profileId = process.env.GEMLOGIN_PROFILE_ID || '1';
    await this.startProfile(profileId);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  static getStatus() {
    return {
      isRunning: this.running,
      activeProfileId: this.activeProfileId,
      apiUrl: getApiUrl(),
      cdpInjected: this.running && !!process.env.CHROME_CDP_URL,
    };
  }
}
