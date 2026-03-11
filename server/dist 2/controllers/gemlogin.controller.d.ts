import { Request, Response } from 'express';
export declare class GemLoginController {
    static getBrowserVersions(_req: Request, res: Response): Promise<void>;
    static getGroups(_req: Request, res: Response): Promise<void>;
    static getProfiles(_req: Request, res: Response): Promise<void>;
    static getProfile(req: Request, res: Response): Promise<void>;
    static createProfile(req: Request, res: Response): Promise<void>;
    static updateProfile(req: Request, res: Response): Promise<void>;
    static deleteProfile(req: Request, res: Response): Promise<void>;
    static changeFingerprint(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/gemlogin/start
     * Body: { profileId: string }
     * Khởi động browser và inject CHROME_CDP_URL để scraper dùng.
     */
    static startProfile(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/gemlogin/close
     * Body (optional): { profileId?: string }
     */
    static closeProfile(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/gemlogin/status
     */
    static getStatus(_req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=gemlogin.controller.d.ts.map