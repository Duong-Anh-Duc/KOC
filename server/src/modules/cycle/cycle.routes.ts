import { Router } from 'express';
import { adminOnly, authMiddleware, requireAnyPermission, validate } from '../../middlewares';
import { createCycleSchema, updateCycleSchema } from '../../types/validation';
import { CycleController } from './cycle.controller';

const router = Router();

router.use(authMiddleware);

// Exchange rate (must be before /:id routes)
router.get('/exchange-rate', CycleController.getExchangeRate);

router.get('/', CycleController.getAll);
router.get('/:id', CycleController.getById);
router.post('/', requireAnyPermission('manage_cycle'), validate(createCycleSchema), CycleController.create);
router.put('/:id', requireAnyPermission('manage_cycle'), validate(updateCycleSchema), CycleController.update);
router.patch('/:id/lock', requireAnyPermission('manage_cycle'), CycleController.lock);
router.patch('/:id/lock-rate', requireAnyPermission('manage_cycle'), CycleController.lockExchangeRate);
router.patch('/:id/unlock-rate', requireAnyPermission('manage_cycle'), CycleController.unlockExchangeRate);
router.patch('/:id/reopen', requireAnyPermission('manage_cycle'), CycleController.reopen);
router.patch('/:id/complete', requireAnyPermission('manage_cycle'), CycleController.complete);
router.post('/:id/add-kocs', requireAnyPermission('manage_cycle'), CycleController.addKocs);
router.post('/:id/scrape-revenue', requireAnyPermission('run_scraper'), CycleController.scrapeRevenue);
router.post('/:id/check-pub-codes', requireAnyPermission('run_scraper'), CycleController.checkPubCodes);
router.delete('/:id', adminOnly, CycleController.delete);

export default router;
