"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoLoginController = void 0;
const gologin_service_1 = require("../services/gologin.service");
class GoLoginController {
    /**
     * POST /api/gologin/start
     * Body (optional): { profileId?: string }
     * Khởi động GoLogin profile và inject CHROME_CDP_URL để scraper dùng.
     */
    static async start(_req, res) {
        try {
            const result = await gologin_service_1.GoLoginService.start();
            res.json({ success: true, message: 'GoLogin (Orbita) đã khởi động', ...result });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    /**
     * POST /api/gologin/stop
     * Body (optional): { stopLocal?: boolean }
     * Dừng GoLogin profile.
     */
    static async stop(_req, res) {
        try {
            await gologin_service_1.GoLoginService.stop();
            res.json({ success: true, message: 'GoLogin (Orbita) đã dừng' });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    }
    /**
     * GET /api/gologin/status
     * Trạng thái GoLogin profile hiện tại.
     */
    static async getStatus(_req, res) {
        const status = gologin_service_1.GoLoginService.getStatus();
        res.json({ success: true, ...status });
    }
}
exports.GoLoginController = GoLoginController;
//# sourceMappingURL=gologin.controller.js.map