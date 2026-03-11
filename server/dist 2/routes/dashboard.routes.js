"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const router = (0, express_1.Router)();
router.use(middlewares_1.authMiddleware);
router.get('/overview', controllers_1.DashboardController.getOverview);
router.get('/revenue-trend', controllers_1.DashboardController.getRevenueTrend);
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map