import { Router } from 'express';
import { authMiddleware } from '../../middlewares';
import { DashboardController } from './dashboard.controller';

const router = Router();

router.use(authMiddleware);

router.get('/overview', DashboardController.getOverview);
router.get('/revenue-trend', DashboardController.getRevenueTrend);

export default router;
