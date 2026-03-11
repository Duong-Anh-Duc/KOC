"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gemlogin_controller_1 = require("../controllers/gemlogin.controller");
const middlewares_1 = require("../middlewares");
const router = (0, express_1.Router)();
router.use(middlewares_1.authMiddleware);
// ── Info ──────────────────────────────────────────────────────────────────────
router.get('/browser-versions', gemlogin_controller_1.GemLoginController.getBrowserVersions);
router.get('/groups', gemlogin_controller_1.GemLoginController.getGroups);
// ── Profiles ──────────────────────────────────────────────────────────────────
router.get('/profiles', gemlogin_controller_1.GemLoginController.getProfiles);
router.get('/profiles/:id', gemlogin_controller_1.GemLoginController.getProfile);
router.post('/profiles', gemlogin_controller_1.GemLoginController.createProfile);
router.put('/profiles/:id', gemlogin_controller_1.GemLoginController.updateProfile);
router.delete('/profiles/:id', gemlogin_controller_1.GemLoginController.deleteProfile);
router.post('/profiles/fingerprint', gemlogin_controller_1.GemLoginController.changeFingerprint);
// ── Browser control (tích hợp với YouTubeScraperService) ─────────────────────
router.post('/start', gemlogin_controller_1.GemLoginController.startProfile);
router.post('/close', gemlogin_controller_1.GemLoginController.closeProfile);
router.get('/status', gemlogin_controller_1.GemLoginController.getStatus);
exports.default = router;
//# sourceMappingURL=gemlogin.routes.js.map