import { Router } from 'express';
import { adminOnly, authMiddleware, validate } from '../../middlewares';
import { loginSchema, registerSchema } from '../../types/validation';
import { AuthController } from './auth.controller';

const router = Router();

// Public
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/verify-otp', AuthController.verifyOtp);
router.post('/reset-password', AuthController.resetPassword);

// Protected
router.get('/profile', authMiddleware, AuthController.getProfile);
router.put('/profile', authMiddleware, AuthController.updateProfile);
router.post('/change-password', authMiddleware, AuthController.changePassword);

// Admin only
router.post('/register', authMiddleware, adminOnly, validate(registerSchema), AuthController.register);
router.get('/users', authMiddleware, adminOnly, AuthController.listUsers);
router.put('/users/:id', authMiddleware, adminOnly, AuthController.adminUpdateUser);
router.patch('/users/:id/active', authMiddleware, adminOnly, AuthController.toggleUserActive);
router.delete('/users/:id', authMiddleware, adminOnly, AuthController.deleteUser);

export default router;
