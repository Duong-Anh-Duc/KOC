import { Router } from 'express';
import { DashboardController } from '../controllers';
import { authMiddleware } from '../middlewares';

const router = Router();

router.use(authMiddleware);

router.get('/overview', DashboardController.getOverview);
router.get('/revenue-trend', DashboardController.getRevenueTrend);

export default router;
