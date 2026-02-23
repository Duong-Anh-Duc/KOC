import { Router } from 'express';
import { KocPortalController } from '../controllers/koc-portal.controller';
import { authMiddleware } from '../middlewares';

const router = Router();

// All routes require authentication (KOC users)
router.use(authMiddleware);

router.get('/my-revenue', KocPortalController.getMyRevenue);
router.get('/my-stats', KocPortalController.getMyStats);

export default router;
