import { Router } from 'express';
import { authMiddleware, canModify } from '../../middlewares';
import { StatsController } from './stats.controller';

const router = Router();

router.use(authMiddleware);

router.get('/latest', StatsController.getLatest);
router.get('/growth/all', StatsController.getAllGrowth);
router.get('/:kocId/correlation', StatsController.getCorrelation);
router.get('/:kocId/growth', StatsController.getGrowth);
router.get('/:kocId', StatsController.getHistory);
router.post('/:kocId/fetch', canModify, StatsController.fetchStats);
router.post('/fetch-all', canModify, StatsController.fetchAllStats);
router.get('/cron-config', StatsController.getCronConfig);
router.put('/cron-config', canModify, StatsController.updateCronConfig);

export default router;
