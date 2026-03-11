"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const validation_1 = require("../types/validation");
const router = (0, express_1.Router)();
router.use(middlewares_1.authMiddleware);
// Exchange rate (must be before /:id routes)
router.get('/exchange-rate', controllers_1.CycleController.getExchangeRate);
router.get('/', controllers_1.CycleController.getAll);
router.get('/:id', controllers_1.CycleController.getById);
router.post('/', middlewares_1.adminOnly, (0, middlewares_1.validate)(validation_1.createCycleSchema), controllers_1.CycleController.create);
router.put('/:id', middlewares_1.adminOnly, (0, middlewares_1.validate)(validation_1.updateCycleSchema), controllers_1.CycleController.update);
router.patch('/:id/lock', middlewares_1.adminOnly, controllers_1.CycleController.lock);
router.patch('/:id/reopen', middlewares_1.adminOnly, controllers_1.CycleController.reopen);
router.patch('/:id/complete', middlewares_1.adminOnly, controllers_1.CycleController.complete);
router.post('/:id/add-kocs', middlewares_1.adminOnly, controllers_1.CycleController.addKocs);
router.post('/:id/scrape-revenue', middlewares_1.adminOnly, controllers_1.CycleController.scrapeRevenue);
router.post('/:id/check-pub-codes', middlewares_1.adminOnly, controllers_1.CycleController.checkPubCodes);
router.delete('/:id', middlewares_1.adminOnly, controllers_1.CycleController.delete);
exports.default = router;
//# sourceMappingURL=cycle.routes.js.map