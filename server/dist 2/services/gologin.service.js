"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoLoginService = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
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
class GoLoginService {
    static orbitaProcess = null;
    static wsUrl = null;
    static running = false;
    static cdpPort = 9223;
    // ─── Tìm Orbita browser ───────────────────────────────────────────────────
    static getOrbitaExecutablePath() {
        const browserDir = (0, path_1.join)((0, os_1.homedir)(), '.gologin', 'browser');
        if (!(0, fs_1.existsSync)(browserDir))
            return null;
        try {
            const entries = (0, fs_1.readdirSync)(browserDir)
                .filter(d => d.startsWith('orbita-browser-') && !d.endsWith('.tar.gz') && !d.endsWith('.zip'))
                .sort()
                .reverse(); // latest first
            for (const entry of entries) {
                // macOS
                const macPath = (0, path_1.join)(browserDir, entry, 'Orbita-Browser.app', 'Contents', 'MacOS', 'Orbita');
                if ((0, fs_1.existsSync)(macPath))
                    return macPath;
                // Linux
                const linPath = (0, path_1.join)(browserDir, entry, 'chrome');
                if ((0, fs_1.existsSync)(linPath))
                    return linPath;
                // Windows
                const winPath = (0, path_1.join)(browserDir, entry, 'chrome.exe');
                if ((0, fs_1.existsSync)(winPath))
                    return winPath;
            }
        }
        catch {
            // ignore
        }
        return null;
    }
    // ─── start ────────────────────────────────────────────────────────────────
    static async start() {
        if (this.running) {
            throw new Error('GoLogin (Orbita) đang chạy. Dừng lại trước khi start mới.');
        }
        const orbitaPath = this.getOrbitaExecutablePath();
        if (!orbitaPath) {
            throw new Error('Không tìm thấy Orbita browser. Hãy mở GoLogin desktop app để tải Orbita xuống (~/.gologin/browser/).');
        }
        const cdpPort = parseInt(process.env.GOLOGIN_CDP_PORT ?? '9223', 10);
        this.cdpPort = cdpPort;
        const profileDir = process.env.GOLOGIN_PROFILE_DIR ??
            (0, path_1.join)((0, os_1.homedir)(), '.gologin', 'local-profiles', 'default');
        if (!(0, fs_1.existsSync)(profileDir)) {
            (0, fs_1.mkdirSync)(profileDir, { recursive: true });
            logger_middleware_1.default.info(`[GoLogin] Tạo profile dir: ${profileDir}`);
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
        logger_middleware_1.default.info(`[GoLogin] Khởi động Orbita: ${orbitaPath} (port=${cdpPort}, headless=${headless})`);
        await new Promise((resolve, reject) => {
            this.orbitaProcess = (0, child_process_1.execFile)(orbitaPath, args, { env: process.env });
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
            const { YouTubeScraperService } = await Promise.resolve().then(() => __importStar(require('./youtube-scraper.service')));
            await YouTubeScraperService.closeBrowser();
        }
        catch {
            // ignore
        }
        logger_middleware_1.default.info(`[GoLogin] Orbita đã khởi động. CDP: ${cdpUrl}  WS: ${wsUrl}`);
        return { wsUrl };
    }
    // ─── stop ─────────────────────────────────────────────────────────────────
    static async stop() {
        if (!this.running) {
            throw new Error('Không có GoLogin (Orbita) nào đang chạy');
        }
        // Đóng context Playwright trước
        try {
            const { YouTubeScraperService } = await Promise.resolve().then(() => __importStar(require('./youtube-scraper.service')));
            await YouTubeScraperService.closeBrowser();
        }
        catch {
            // ignore
        }
        if (this.orbitaProcess) {
            try {
                this.orbitaProcess.kill('SIGTERM');
            }
            catch {
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
        logger_middleware_1.default.info(`[GoLogin] Orbita đã dừng`);
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
    static _waitForCDP(port, timeoutMs) {
        const started = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                const http = require('http');
                const req = http.get(`http://localhost:${port}/json/version`, (res) => {
                    res.resume();
                    if (res.statusCode === 200)
                        return resolve();
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
    static _getCDPWebsocketUrl(cdpUrl) {
        const http = require('http');
        return new Promise((resolve, reject) => {
            http.get(`${cdpUrl}/json/version`, (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.webSocketDebuggerUrl ?? cdpUrl);
                    }
                    catch {
                        resolve(cdpUrl);
                    }
                });
            }).on('error', () => resolve(cdpUrl));
        });
    }
}
exports.GoLoginService = GoLoginService;
//# sourceMappingURL=gologin.service.js.map