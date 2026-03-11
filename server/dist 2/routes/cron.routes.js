"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cron_controller_1 = require("../controllers/cron.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// All cron routes require authentication + admin
router.use(auth_middleware_1.authMiddleware);
router.use(auth_middleware_1.adminOnly);
router.get('/config', cron_controller_1.CronController.getConfig);
router.put('/config', cron_controller_1.CronController.updateConfig);
router.post('/run', cron_controller_1.CronController.runNow);
router.get('/history', cron_controller_1.CronController.getHistory);
router.get('/next-month', cron_controller_1.CronController.previewNextRun);
exports.default = router;
//# sourceMappingURL=cron.routes.js.map