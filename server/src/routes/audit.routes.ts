import { Router } from 'express';
import { AuditController } from '../controllers';
import { adminOnly, authMiddleware } from '../middlewares';

const router = Router();

router.use(authMiddleware);
router.use(adminOnly);

router.get('/', AuditController.getLogs);

export default router;
