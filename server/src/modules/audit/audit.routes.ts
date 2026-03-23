import { Router } from 'express';
import { adminOnly, authMiddleware } from '../../middlewares';
import { AuditController } from './audit.controller';

const router = Router();

router.use(authMiddleware);
router.use(adminOnly);

router.get('/', AuditController.getLogs);

export default router;
