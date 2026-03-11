"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GemLoginController = void 0;
const gemlogin_service_1 = require("../services/gemlogin.service");
class GemLoginController {
    // ── Info ──────────────────────────────────────────────────────────────────
    static async getBrowserVersions(_req, res) {
        try {
            const data = await gemlogin_service_1.GemLoginService.getBrowserVersions();
            res.json({ success: true, data });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getGroups(_req, res) {
        try {
            const data = await gemlogin_service_1.GemLoginService.getGroups();
            res.json({ success: true, data });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    // ── Profiles ──────────────────────────────────────────────────────────────
    static async getProfiles(_req, res) {
        try {
            const data = await gemlogin_service_1.GemLoginService.getProfiles();
            res.json({ success: true, data });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getProfile(req, res) {
        try {
            const data = await gemlogin_service_1.GemLoginService.getProfile(req.params.id);
            res.json({ success: true, data });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    static async createProfile(req, res) {
        try {
            const data = await gemlogin_service_1.GemLoginService.createProfile(req.body);
            res.json({ success: true, data });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    static async updateProfile(req, res) {
        try {
            const data = await gemlogin_service_1.GemLoginService.updateProfile(req.params.id, req.body);
            res.json({ success: true, data });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    static async deleteProfile(req, res) {
        try {
            const data = await gemlogin_service_1.GemLoginService.deleteProfile(req.params.id);
            res.json({ success: true, data });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    static async changeFingerprint(req, res) {
        try {
            const ids = req.query.ids ? String(req.query.ids).split(',') : undefined;
            const data = await gemlogin_service_1.GemLoginService.changeFingerprint(ids);
            res.json({ success: true, data });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    // ── Start / Close (tích hợp với YouTubeScraperService) ───────────────────
    /**
     * POST /api/gemlogin/start
     * Body: { profileId: string }
     * Khởi động browser và inject CHROME_CDP_URL để scraper dùng.
     */
    static async startProfile(req, res) {
        try {
            const profileId = req.body?.profileId || process.env.GEMLOGIN_PROFILE_ID;
            if (!profileId) {
                res.status(400).json({ success: false, message: 'Thiếu profileId' });
                return;
            }
            const result = await gemlogin_service_1.GemLoginService.startProfile(profileId);
            res.json({ success: true, message: 'GemLogin profile đã khởi động', ...result });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    /**
     * POST /api/gemlogin/close
     * Body (optional): { profileId?: string }
     */
    static async closeProfile(req, res) {
        try {
            const profileId = req.body?.profileId;
            await gemlogin_service_1.GemLoginService.closeProfile(profileId);
            res.json({ success: true, message: 'GemLogin profile đã đóng' });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    /**
     * GET /api/gemlogin/status
     */
    static async getStatus(_req, res) {
        const status = gemlogin_service_1.GemLoginService.getStatus();
        res.json({ success: true, ...status });
    }
}
exports.GemLoginController = GemLoginController;
//# sourceMappingURL=gemlogin.controller.js.map