"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controllers_1 = require("../controllers");
const middlewares_1 = require("../middlewares");
const validation_1 = require("../types/validation");
const router = (0, express_1.Router)();
router.use(middlewares_1.authMiddleware);
// Preview calculation (no save)
router.post('/calculate', controllers_1.RevenueController.previewCalculation);
// Payment status (accumulated balance / $100 threshold)
router.get('/payment-status', controllers_1.RevenueController.getPaymentStatus);
// Records
router.get('/records', controllers_1.RevenueController.getRecordsByCycle);
router.get('/records/:id', controllers_1.RevenueController.getRecordById);
router.post('/records', (0, middlewares_1.validate)(validation_1.createRevenueRecordSchema), controllers_1.RevenueController.createRecord);
router.post('/records/bulk', (0, middlewares_1.validate)(validation_1.bulkCreateRevenueRecordSchema), controllers_1.RevenueController.bulkCreateRecords);
router.put('/records/:id', (0, middlewares_1.validate)(validation_1.updateRevenueRecordSchema), controllers_1.RevenueController.updateRecord);
router.delete('/records/bulk', middlewares_1.adminOnly, controllers_1.RevenueController.bulkDeleteRecords);
router.delete('/records/:id', middlewares_1.adminOnly, controllers_1.RevenueController.deleteRecord);
router.patch('/records/:id/approve', middlewares_1.adminOnly, controllers_1.RevenueController.approveRecord);
exports.default = router;
//# sourceMappingURL=revenue.routes.js.map