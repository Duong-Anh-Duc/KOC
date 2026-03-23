import { Router } from 'express';
import { adminOnly, authMiddleware, validate } from '../../middlewares';
import { createKOCSchema, createKocAccountSchema, updateKOCSchema } from '../../types/validation';
import { AuthController } from '../auth/auth.controller';
import { KOCController } from './koc.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/accounts-status', adminOnly, KOCController.getAccountsStatus);
router.get('/fetch-pub-code/:channelId', adminOnly, KOCController.fetchPubCode);
router.get('/active', KOCController.getActive);
router.get('/', KOCController.getAll);
router.get('/:id', KOCController.getById);

// Admin only for CUD operations
router.post('/', adminOnly, validate(createKOCSchema), KOCController.create);
router.put('/:id', adminOnly, validate(updateKOCSchema), KOCController.update);
router.delete('/:id', adminOnly, KOCController.delete);

// Admin only - create a user account for a KOC
router.post('/:id/account', adminOnly, validate(createKocAccountSchema), AuthController.createKocAccount);

export default router;
