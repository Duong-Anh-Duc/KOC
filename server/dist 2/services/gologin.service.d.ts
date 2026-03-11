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
export declare class GoLoginService {
    private static orbitaProcess;
    private static wsUrl;
    private static running;
    private static cdpPort;
    static getOrbitaExecutablePath(): string | null;
    static start(): Promise<{
        wsUrl: string;
    }>;
    static stop(): Promise<void>;
    static getStatus(): {
        isRunning: boolean;
        profileId: null;
        wsUrl: string | null;
        cdpInjected: boolean;
        orbitaPath: string | null;
    };
    /** Poll CDP /json/version cho đến khi browser sẵn sàng */
    private static _waitForCDP;
    /** Lấy WebSocket URL từ CDP /json/version */
    private static _getCDPWebsocketUrl;
}
//# sourceMappingURL=gologin.service.d.ts.map