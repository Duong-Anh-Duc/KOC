import { Router } from 'express';
import { GoLoginController } from '../controllers/gologin.controller';
import { authMiddleware } from '../middlewares';

const router = Router();

router.use(authMiddleware);

router.post('/start', GoLoginController.start);
router.post('/stop', GoLoginController.stop);
router.get('/status', GoLoginController.getStatus);

export default router;
