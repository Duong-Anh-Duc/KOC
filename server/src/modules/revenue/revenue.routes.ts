import { Router } from 'express';
import { RevenueController } from './revenue.controller';
import { adminOnly, authMiddleware, canModify, requireAnyPermission, validate } from '../../middlewares';
import {
    bulkCreateRevenueRecordSchema,
    createRevenueRecordSchema,
    updateRevenueRecordSchema,
} from '../../types/validation';

const router = Router();

router.use(authMiddleware);

// Preview calculation (no save)
router.post('/calculate', canModify, RevenueController.previewCalculation);

// Payment status (accumulated balance / $100 threshold)
router.get('/payment-status', RevenueController.getPaymentStatus);

// Records
router.get('/records', RevenueController.getRecordsByCycle);
router.get('/records/:id', RevenueController.getRecordById);
router.post('/records', canModify, validate(createRevenueRecordSchema), RevenueController.createRecord);
router.post('/records/bulk', canModify, validate(bulkCreateRevenueRecordSchema), RevenueController.bulkCreateRecords);
router.put('/records/:id', canModify, validate(updateRevenueRecordSchema), RevenueController.updateRecord);
router.delete('/records/bulk', requireAnyPermission('delete_revenue'), RevenueController.bulkDeleteRecords);
router.delete('/records/:id', requireAnyPermission('delete_revenue'), RevenueController.deleteRecord);
router.patch('/records/:id/approve', requireAnyPermission('approve_revenue'), RevenueController.approveRecord);
router.patch('/records/:id/unapprove', requireAnyPermission('approve_revenue'), RevenueController.unapproveRecord);

export default router;
