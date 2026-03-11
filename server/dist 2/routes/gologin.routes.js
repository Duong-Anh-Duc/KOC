"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gologin_controller_1 = require("../controllers/gologin.controller");
const middlewares_1 = require("../middlewares");
const router = (0, express_1.Router)();
router.use(middlewares_1.authMiddleware);
router.post('/start', gologin_controller_1.GoLoginController.start);
router.post('/stop', gologin_controller_1.GoLoginController.stop);
router.get('/status', gologin_controller_1.GoLoginController.getStatus);
exports.default = router;
//# sourceMappingURL=gologin.routes.js.map