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
export declare class GemLoginService {
    /** ID của profile đang được quản lý bởi service (nếu có) */
    private static activeProfileId;
    private static running;
    static getBrowserVersions(): Promise<BrowserVersion[]>;
    static getGroups(): Promise<Group[]>;
    static getProfiles(): Promise<Profile[]>;
    static getProfile(id: string): Promise<Profile>;
    static createProfile(payload: CreateProfilePayload): Promise<Profile>;
    static updateProfile(profileId: string, payload: Partial<CreateProfilePayload>): Promise<Profile>;
    static deleteProfile(id: string): Promise<unknown>;
    static changeFingerprint(ids?: string[]): Promise<unknown>;
    /**
     * Khởi động browser instance cho profile, inject CHROME_CDP_URL để
     * YouTubeScraperService tự dùng qua CDP.
     */
    static startProfile(profileId: string): Promise<StartProfileResult>;
    /**
     * Đóng browser instance đang chạy và xoá CHROME_CDP_URL.
     */
    static closeProfile(profileId?: string): Promise<void>;
    static getStatus(): {
        isRunning: boolean;
        activeProfileId: string | null;
        apiUrl: string;
        cdpInjected: boolean;
    };
}
//# sourceMappingURL=gemlogin.service.d.ts.map