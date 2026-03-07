import { Router } from 'express';
import { CycleController } from '../controllers';
import { adminOnly, authMiddleware, validate } from '../middlewares';
import { createCycleSchema, updateCycleSchema } from '../types/validation';

const router = Router();

router.use(authMiddleware);

// Exchange rate (must be before /:id routes)
router.get('/exchange-rate', CycleController.getExchangeRate);

router.get('/', CycleController.getAll);
router.get('/:id', CycleController.getById);
router.post('/', adminOnly, validate(createCycleSchema), CycleController.create);
router.put('/:id', adminOnly, validate(updateCycleSchema), CycleController.update);
router.patch('/:id/lock', adminOnly, CycleController.lock);
router.patch('/:id/reopen', adminOnly, CycleController.reopen);
router.patch('/:id/complete', adminOnly, CycleController.complete);
router.post('/:id/add-kocs', adminOnly, CycleController.addKocs);
router.post('/:id/scrape-revenue', adminOnly, CycleController.scrapeRevenue);
router.post('/:id/check-pub-codes', adminOnly, CycleController.checkPubCodes);
router.delete('/:id', adminOnly, CycleController.delete);

export default router;
