"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const validation_1 = require("../types/validation");
const router = (0, express_1.Router)();
// Public
router.post('/login', (0, middlewares_1.validate)(validation_1.loginSchema), controllers_1.AuthController.login);
// Protected
router.get('/profile', middlewares_1.authMiddleware, controllers_1.AuthController.getProfile);
// Admin only
router.post('/register', middlewares_1.authMiddleware, middlewares_1.adminOnly, (0, middlewares_1.validate)(validation_1.registerSchema), controllers_1.AuthController.register);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map