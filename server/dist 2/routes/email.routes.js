"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const email_controller_1 = require("../controllers/email.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// All email routes require authentication + admin
router.use(auth_middleware_1.authMiddleware);
router.use(auth_middleware_1.adminOnly);
router.get('/config', email_controller_1.EmailController.getConfig);
router.put('/config', email_controller_1.EmailController.updateConfig);
router.post('/test', email_controller_1.EmailController.sendTestEmail);
router.post('/send-revenue', email_controller_1.EmailController.sendRevenueEmails);
router.get('/cycles', email_controller_1.EmailController.getAvailableCycles);
exports.default = router;
//# sourceMappingURL=email.routes.js.map