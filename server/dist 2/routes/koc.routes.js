"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const validation_1 = require("../types/validation");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(middlewares_1.authMiddleware);
router.get('/accounts-status', middlewares_1.adminOnly, controllers_1.KOCController.getAccountsStatus);
router.get('/active', controllers_1.KOCController.getActive);
router.get('/', controllers_1.KOCController.getAll);
router.get('/:id', controllers_1.KOCController.getById);
// Admin only for CUD operations
router.post('/', middlewares_1.adminOnly, (0, middlewares_1.validate)(validation_1.createKOCSchema), controllers_1.KOCController.create);
router.put('/:id', middlewares_1.adminOnly, (0, middlewares_1.validate)(validation_1.updateKOCSchema), controllers_1.KOCController.update);
router.delete('/:id', middlewares_1.adminOnly, controllers_1.KOCController.delete);
// Admin only - create a user account for a KOC
router.post('/:id/account', middlewares_1.adminOnly, (0, middlewares_1.validate)(validation_1.createKocAccountSchema), controllers_1.AuthController.createKocAccount);
exports.default = router;
//# sourceMappingURL=koc.routes.js.map