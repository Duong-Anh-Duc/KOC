import { Router } from 'express';
import { GoLoginController } from '../controllers/gologin.controller';
import { authMiddleware, canModify } from '../middlewares';

const router = Router();

router.use(authMiddleware);

router.post('/start', canModify, GoLoginController.start);
router.post('/stop', canModify, GoLoginController.stop);
router.get('/status', GoLoginController.getStatus);

export default router;
