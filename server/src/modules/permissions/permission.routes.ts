import { Router } from 'express';
import { PermissionController } from './permission.controller';
import { adminOnly, authMiddleware } from '../../middlewares';

const router = Router();

// Get current user's accessible KOC IDs
router.get('/my', authMiddleware, PermissionController.getMyPermissions);

// Get all managers + KOCs + access map (Admin only)
router.get('/', authMiddleware, adminOnly, PermissionController.getPermissions);

// Toggle a KOC on/off for a manager (Admin only)
router.put('/manager/:managerId/koc/:kocId/toggle', authMiddleware, adminOnly, PermissionController.toggleKocAccess);

// Update detailed permissions for a manager + KOC (Admin only)
router.put('/manager/:managerId/koc/:kocId/permissions', authMiddleware, adminOnly, PermissionController.updateKocPermissions);

// Bulk select/deselect all KOCs for a manager (Admin only)
router.put('/manager/:managerId/bulk', authMiddleware, adminOnly, PermissionController.bulkToggle);

export default router;
