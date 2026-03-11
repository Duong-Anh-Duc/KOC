"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const koc_portal_controller_1 = require("../controllers/koc-portal.controller");
const middlewares_1 = require("../middlewares");
const router = (0, express_1.Router)();
// All routes require authentication (KOC users)
router.use(middlewares_1.authMiddleware);
router.get('/my-revenue', koc_portal_controller_1.KocPortalController.getMyRevenue);
router.get('/my-stats', koc_portal_controller_1.KocPortalController.getMyStats);
exports.default = router;
//# sourceMappingURL=koc-portal.routes.js.map