import { Router } from 'express';
import { AuthController } from '../controllers';
import { adminOnly, authMiddleware, validate } from '../middlewares';
import { loginSchema, registerSchema } from '../types/validation';

const router = Router();

// Public
router.post('/login', validate(loginSchema), AuthController.login);

// Protected
router.get('/profile', authMiddleware, AuthController.getProfile);

// Admin only
router.post('/register', authMiddleware, adminOnly, validate(registerSchema), AuthController.register);

export default router;
