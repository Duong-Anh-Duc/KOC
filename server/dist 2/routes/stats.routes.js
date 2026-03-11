"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const router = (0, express_1.Router)();
router.use(middlewares_1.authMiddleware);
router.get('/latest', controllers_1.StatsController.getLatest);
router.get('/growth/all', controllers_1.StatsController.getAllGrowth);
router.get('/:kocId/correlation', controllers_1.StatsController.getCorrelation);
router.get('/:kocId/growth', controllers_1.StatsController.getGrowth);
router.get('/:kocId', controllers_1.StatsController.getHistory);
router.post('/:kocId/fetch', controllers_1.StatsController.fetchStats);
router.post('/fetch-all', controllers_1.StatsController.fetchAllStats);
exports.default = router;
//# sourceMappingURL=stats.routes.js.map