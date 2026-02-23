import { Router } from 'express';
import { CronController } from '../controllers/cron.controller';
import { adminOnly, authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// All cron routes require authentication + admin
router.use(authMiddleware);
router.use(adminOnly);

router.get('/config', CronController.getConfig);
router.put('/config', CronController.updateConfig);
router.post('/run', CronController.runNow);
router.get('/history', CronController.getHistory);
router.get('/next-month', CronController.previewNextRun);

export default router;
