import { Router } from 'express';
import { authMiddleware, canModify } from '../../middlewares';
import { SettingsController } from './settings.controller';

const router = Router();

router.use(authMiddleware);

// Google login credentials
router.get('/google-login', SettingsController.getGoogleLogin);
router.put('/google-login', canModify, SettingsController.updateGoogleLogin);
router.post('/google-login/test', canModify, SettingsController.testGoogleLogin);

export default router;
