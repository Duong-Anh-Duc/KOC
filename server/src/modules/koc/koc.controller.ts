import { NextFunction, Request, Response } from 'express';
import prisma from '../../config/database';
import { AUDIT_ACTIONS, ENTITIES } from '../../constants';
import { AuthenticatedRequest } from '../../types';
import { AuditLogService } from '../audit/audit.service';
import { KOCService } from './koc.service';

export class KOCController {
  /**
   * GET /api/kocs
   * Admin users only see their own KOCs
   */
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const authReq = req as AuthenticatedRequest;
      const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;

      const result = await KOCService.getAll({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        adminId,
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
   * Admin users only see their own active KOCs
   */
  static async getActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
      const kocs = await KOCService.getActiveKOCs(adminId);

      const t = (req as any).t;
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
      const authReq = req as AuthenticatedRequest;
      const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
      const koc = await KOCService.getById(req.params.id as string, adminId);

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
   * Automatically assigns the KOC to the creating admin
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const koc = await KOCService.create({ ...req.body, admin_id: adminId });

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
      console.log('KOC UPDATE - Raw request body:', JSON.stringify(req.body, null, 2));
      console.log('KOC UPDATE - min_payment type:', typeof req.body.min_payment, 'value:', req.body.min_payment);

      // Check ownership before update
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      if (adminId) {
        await KOCService.getById(req.params.id as string, adminId); // throws 403 if not owner
      }
      
      const { koc, oldValue } = await KOCService.update(req.params.id as string, req.body);
      
      console.log('KOC UPDATE - After DB update, new min_payment:', koc.min_payment, 'type:', typeof koc.min_payment);

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
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const koc = await KOCService.delete(req.params.id as string, adminId);

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
   * Admin only sees their own KOCs' account status
   */
  static async getAccountsStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;

      // Get KOC IDs managed by this admin
      let kocFilter: any = { koc_id: { not: null } };
      if (adminId) {
        const managedKocIds = await prisma.kOC.findMany({
          where: { admin_id: adminId },
          select: { id: true },
        });
        const ids = managedKocIds.map(k => k.id);
        kocFilter = { koc_id: { in: ids } };
      }

      const usersWithKoc = await prisma.user.findMany({
        where: kocFilter,
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

  /**
   * GET /api/kocs/fetch-pub-code/:channelId
   * Scrape pub code from YouTube Studio monetization page
   */
  static async fetchPubCode(req: Request, res: Response): Promise<void> {
    try {
      const { channelId } = req.params;
      const authReq = req as AuthenticatedRequest;
      const adminId = authReq.user?.userId;

      const { PubCodeService } = await import('../shared/pub-code.service');
      const pubCode = await PubCodeService.scrapePubCode(channelId as string, adminId);

      res.json({
        success: true,
        data: { pub_code: pubCode },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch pub code',
      });
    }
  }
}
