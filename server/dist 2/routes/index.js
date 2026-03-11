"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const audit_routes_1 = __importDefault(require("./audit.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const cron_routes_1 = __importDefault(require("./cron.routes"));
const cycle_routes_1 = __importDefault(require("./cycle.routes"));
const dashboard_routes_1 = __importDefault(require("./dashboard.routes"));
const email_routes_1 = __importDefault(require("./email.routes"));
const koc_portal_routes_1 = __importDefault(require("./koc-portal.routes"));
const koc_routes_1 = __importDefault(require("./koc.routes"));
const progress_routes_1 = __importDefault(require("./progress.routes"));
const revenue_routes_1 = __importDefault(require("./revenue.routes"));
const stats_routes_1 = __importDefault(require("./stats.routes"));
const youtube_api_routes_1 = __importDefault(require("./youtube-api.routes"));
const gologin_routes_1 = __importDefault(require("./gologin.routes"));
const gemlogin_routes_1 = __importDefault(require("./gemlogin.routes"));
const youtube_scraper_routes_1 = __importDefault(require("./youtube-scraper.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/kocs', koc_routes_1.default);
router.use('/koc-portal', koc_portal_routes_1.default);
router.use('/revenue', revenue_routes_1.default);
router.use('/cycles', cycle_routes_1.default);
router.use('/stats', stats_routes_1.default);
router.use('/dashboard', dashboard_routes_1.default);
router.use('/audit-logs', audit_routes_1.default);
router.use('/yt-scraper', youtube_scraper_routes_1.default);
router.use('/youtube', youtube_api_routes_1.default);
router.use('/cron', cron_routes_1.default);
router.use('/email', email_routes_1.default);
router.use('/progress', progress_routes_1.default);
router.use('/gologin', gologin_routes_1.default);
router.use('/gemlogin', gemlogin_routes_1.default);
// Health check
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
exports.default = router;
//# sourceMappingURL=index.js.map