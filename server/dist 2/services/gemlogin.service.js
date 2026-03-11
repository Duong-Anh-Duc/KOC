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
exports.GemLoginService = void 0;
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
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
function getApiUrl() {
    return (process.env.GEMLOGIN_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
}
async function request(method, path, body) {
    const url = `${getApiUrl()}${path}`;
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) {
        opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`GemLogin API ${method} ${path} → ${res.status}: ${text}`);
    }
    return res.json();
}
// ─── Service ──────────────────────────────────────────────────────────────────
class GemLoginService {
    /** ID của profile đang được quản lý bởi service (nếu có) */
    static activeProfileId = null;
    static running = false;
    // ── Browser Versions ──────────────────────────────────────────────────────
    static getBrowserVersions() {
        return request('GET', '/api/browser_versions');
    }
    // ── Groups ────────────────────────────────────────────────────────────────
    static getGroups() {
        return request('GET', '/api/groups');
    }
    // ── Profiles ──────────────────────────────────────────────────────────────
    static getProfiles() {
        return request('GET', '/api/profiles');
    }
    static getProfile(id) {
        return request('GET', `/api/profile/${id}`);
    }
    static createProfile(payload) {
        return request('POST', '/api/profiles/create', payload);
    }
    static updateProfile(profileId, payload) {
        return request('POST', `/api/profiles/update/${profileId}`, payload);
    }
    static deleteProfile(id) {
        return request('GET', `/api/profiles/delete/${id}`);
    }
    static changeFingerprint(ids) {
        const query = ids?.length ? `?ids=${ids.join(',')}` : '';
        return request('GET', `/api/profiles/changeFingerprint${query}`);
    }
    // ── Start / Close browser ─────────────────────────────────────────────────
    /**
     * Khởi động browser instance cho profile, inject CHROME_CDP_URL để
     * YouTubeScraperService tự dùng qua CDP.
     */
    static async startProfile(profileId) {
        if (this.running) {
            throw new Error(`GemLogin đang chạy profile "${this.activeProfileId}". Đóng trước khi start mới.`);
        }
        logger_middleware_1.default.info(`[GemLogin] Khởi động profile: ${profileId}`);
        const raw = await request('GET', `/api/profiles/start/${profileId}`);
        const wsUrl = raw.wsUrl ||
            raw.ws ||
            (typeof raw === 'string' ? raw : undefined);
        if (!wsUrl) {
            throw new Error(`GemLogin không trả về wsUrl. Response: ${JSON.stringify(raw)}`);
        }
        // Chuyển ws:// → http:// để dùng với connectOverCDP
        const cdpUrl = wsUrl.startsWith('ws://')
            ? wsUrl.replace(/^ws:\/\//, 'http://').replace(/\/devtools\/browser\/.+$/, '')
            : wsUrl.startsWith('wss://')
                ? wsUrl.replace(/^wss:\/\//, 'https://').replace(/\/devtools\/browser\/.+$/, '')
                : wsUrl;
        this.activeProfileId = profileId;
        this.running = true;
        // Inject → YouTubeScraperService tự dùng
        process.env.CHROME_CDP_URL = cdpUrl;
        // Reset context cũ để force reconnect
        try {
            const { YouTubeScraperService } = await Promise.resolve().then(() => __importStar(require('./youtube-scraper.service')));
            await YouTubeScraperService.closeBrowser();
        }
        catch {
            // ignore
        }
        logger_middleware_1.default.info(`[GemLogin] Profile ${profileId} đã start. CDP: ${cdpUrl}  WS: ${wsUrl}`);
        return { wsUrl, cdpUrl, profileId };
    }
    /**
     * Đóng browser instance đang chạy và xoá CHROME_CDP_URL.
     */
    static async closeProfile(profileId) {
        const id = profileId || this.activeProfileId;
        if (!id) {
            throw new Error('Không có profile nào đang chạy');
        }
        logger_middleware_1.default.info(`[GemLogin] Đóng profile: ${id}`);
        // Đóng Playwright context trước
        try {
            const { YouTubeScraperService } = await Promise.resolve().then(() => __importStar(require('./youtube-scraper.service')));
            await YouTubeScraperService.closeBrowser();
        }
        catch {
            // ignore
        }
        await request('GET', `/api/profiles/close/${id}`);
        if (this.activeProfileId === id) {
            process.env.CHROME_CDP_URL = '';
            this.activeProfileId = null;
            this.running = false;
        }
        logger_middleware_1.default.info(`[GemLogin] Profile ${id} đã đóng`);
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
exports.GemLoginService = GemLoginService;
//# sourceMappingURL=gemlogin.service.js.map