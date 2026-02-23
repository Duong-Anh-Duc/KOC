import { Router } from 'express';
import { RevenueController } from '../controllers';
import { adminOnly, authMiddleware, validate } from '../middlewares';
import {
    bulkCreateRevenueRecordSchema,
    createRevenueRecordSchema,
    updateRevenueRecordSchema,
} from '../types/validation';

const router = Router();

router.use(authMiddleware);

// Preview calculation (no save)
router.post('/calculate', RevenueController.previewCalculation);

// Payment status (accumulated balance / $100 threshold)
router.get('/payment-status', RevenueController.getPaymentStatus);

// Records
router.get('/records', RevenueController.getRecordsByCycle);
router.get('/records/:id', RevenueController.getRecordById);
router.post('/records', validate(createRevenueRecordSchema), RevenueController.createRecord);
router.post('/records/bulk', validate(bulkCreateRevenueRecordSchema), RevenueController.bulkCreateRecords);
router.put('/records/:id', validate(updateRevenueRecordSchema), RevenueController.updateRecord);
router.delete('/records/:id', adminOnly, RevenueController.deleteRecord);
router.patch('/records/:id/approve', adminOnly, RevenueController.approveRecord);

export default router;
