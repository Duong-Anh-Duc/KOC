import { NextFunction, Request, Response } from 'express';
import prisma from '../config/database';
import { AUDIT_ACTIONS, ENTITIES } from '../constants';
import { AuditLogService, KOCService } from '../services';
import { AuthenticatedRequest } from '../types';

export class KOCController {
  /**
   * GET /api/kocs
   */
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;

      const result = await KOCService.getAll({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('koc.listRetrieved') : 'KOCs retrieved',
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/kocs/active
   */
  static async getActive(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const kocs = await KOCService.getActiveKOCs();

      const t = (_req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('koc.activeRetrieved') : 'Active KOCs retrieved',
        data: kocs,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/kocs/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const koc = await KOCService.getById(req.params.id as string);

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('koc.retrieved') : 'KOC retrieved',
        data: koc,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/kocs
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const koc = await KOCService.create(req.body);

      // Audit log
      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.CREATE_KOC,
          ENTITIES.KOC,
          koc.id,
          null,
          { ...koc }
        );
      }

      const t = (req as any).t;
      res.status(201).json({
        success: true,
        message: t ? t('koc.created') : 'KOC created successfully',
        data: koc,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/kocs/:id
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { koc, oldValue } = await KOCService.update(req.params.id as string, req.body);

      // Audit log
      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.UPDATE_KOC,
          ENTITIES.KOC,
          koc.id,
          oldValue as unknown as Record<string, unknown>,
          { ...koc }
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('koc.updated') : 'KOC updated successfully',
        data: koc,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/kocs/:id
   */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const koc = await KOCService.delete(req.params.id as string);

      // Audit log
      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.DELETE_KOC,
          ENTITIES.KOC,
          req.params.id as string,
          { ...koc } as unknown as Record<string, unknown>,
          null
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('koc.deleted') : 'KOC deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/kocs/accounts-status
   * Returns a map of koc_id → boolean indicating if they have a user account
   */
  static async getAccountsStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usersWithKoc = await prisma.user.findMany({
        where: { koc_id: { not: null } },
        select: { koc_id: true },
      });

      const statusMap: Record<string, boolean> = {};
      for (const u of usersWithKoc) {
        if (u.koc_id) statusMap[u.koc_id] = true;
      }

      res.status(200).json({
        success: true,
        data: statusMap,
      });
    } catch (error) {
      next(error);
    }
  }
}
