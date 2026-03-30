import { Response } from 'express';
import { KOC_PERMISSIONS, PermissionService } from './permission.service';
import { AuthenticatedRequest } from '../../types';

export class PermissionController {
  /**
   * GET /api/permissions
   */
  static async getPermissions(req: AuthenticatedRequest, res: Response) {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const [managerKocAccess, managers, kocs, kocPermDefs] = await Promise.all([
        PermissionService.getManagerKocAccess(adminId),
        PermissionService.getManagerUsers(),
        PermissionService.getKocList(adminId),
        PermissionService.getKocPermissionDefinitions(),
      ]);

      res.json({
        success: true,
        data: {
          managerKocAccess,
          managers,
          kocs,
          kocPermissionDefinitions: kocPermDefs,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /api/permissions/manager/:managerId/koc/:kocId/toggle
   * Toggle a KOC on/off for a manager
   */
  static async toggleKocAccess(req: AuthenticatedRequest, res: Response) {
    try {
      const { managerId, kocId } = req.params;
      const { enabled } = req.body;

      await PermissionService.toggleKocAccess(managerId as string, kocId as string, !!enabled);

      res.json({
        success: true,
        message: req.t?.('permissions.updateSuccess') || 'Cập nhật quyền thành công',
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /api/permissions/manager/:managerId/koc/:kocId/permissions
   * Update detailed permissions for a manager + KOC pair
   */
  static async updateKocPermissions(req: AuthenticatedRequest, res: Response) {
    try {
      const { managerId, kocId } = req.params;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        res.status(400).json({ success: false, message: 'permissions must be an array' });
        return;
      }

      await PermissionService.updateKocPermissions(managerId as string, kocId as string, permissions);

      res.json({
        success: true,
        message: req.t?.('permissions.updateSuccess') || 'Cập nhật quyền thành công',
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /api/permissions/manager/:managerId/bulk
   * Select/deselect all KOCs for a manager
   */
  static async bulkToggle(req: AuthenticatedRequest, res: Response) {
    try {
      const { managerId } = req.params;
      const { kocIds, enabled } = req.body;

      await PermissionService.bulkToggleKocAccess(managerId as string, kocIds || [], !!enabled);

      res.json({
        success: true,
        message: req.t?.('permissions.updateSuccess') || 'Cập nhật quyền thành công',
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/permissions/my
   */
  static async getMyPermissions(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const { role, userId } = req.user;

      if (role === 'ACCOUNTANT') {
        const detail = await PermissionService.getManagerAccessDetail(userId);
        res.json({ success: true, data: detail });
        return;
      }

      // Admin sees everything
      res.json({
        success: true,
        data: {
          accessible_koc_ids: [],
          per_koc: {},
          aggregated: Object.keys(KOC_PERMISSIONS),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
