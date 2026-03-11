"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const router = (0, express_1.Router)();
router.use(middlewares_1.authMiddleware);
router.use(middlewares_1.adminOnly);
router.get('/', controllers_1.AuditController.getLogs);
exports.default = router;
//# sourceMappingURL=audit.routes.js.map