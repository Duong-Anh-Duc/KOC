import { Router } from 'express';
import { EmailController } from './email.controller';
import { adminOnly, authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

// All email routes require authentication + admin
router.use(authMiddleware);
router.use(adminOnly);

router.get('/config', EmailController.getConfig);
router.put('/config', EmailController.updateConfig);
router.post('/test', EmailController.sendTestEmail);
router.post('/send-revenue', EmailController.sendRevenueEmails);
router.get('/cycles', EmailController.getAvailableCycles);

export default router;
