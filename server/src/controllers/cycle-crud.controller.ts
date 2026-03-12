import { NextFunction, Request, Response } from 'express';
import { AUDIT_ACTIONS, ENTITIES } from '../constants';
import { AuditLogService, CycleService, ExchangeRateService } from '../services';
import { AuthenticatedRequest } from '../types';

export class CycleCrudController {
  /**
   * GET /api/cycles
   */
  static async getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = _req as AuthenticatedRequest;
      const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
      const cycles = await CycleService.getAll(adminId);

      const t = (_req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.listRetrieved') : 'Cycles retrieved',
        data: cycles,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/cycles/:id
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
      const cycle = await CycleService.getById(Number(req.params.id), adminId);

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.retrieved') : 'Cycle retrieved',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/cycles
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const { month, exchange_rate } = req.body;
      const cycle = await CycleService.create(month, exchange_rate, adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.CREATE_CYCLE,
          ENTITIES.REVENUE_CYCLE,
          String(cycle.id),
          null,
          cycle as unknown as Record<string, unknown>
        );
      }

      const t = (req as any).t;
      res.status(201).json({
        success: true,
        message: t ? t('cycle.created') : 'Revenue cycle created',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/cycles/:id/add-kocs
   * Body: { kocIds?: string[] }  — omit to add ALL missing active KOCs
   */
  static async addKocs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const { kocIds } = req.body as { kocIds?: string[] };
      const result = await CycleService.addKocs(Number(req.params.id), kocIds, adminId);
      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.kocsAdded', { count: result.added }) : `Added ${result.added} KOC(s) to cycle`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/cycles/:id
   */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const cycle = await CycleService.update(Number(req.params.id), req.body, adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.UPDATE_CYCLE,
          ENTITIES.REVENUE_CYCLE,
          String(cycle.id),
          null,
          cycle as unknown as Record<string, unknown>
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.updated') : 'Revenue cycle updated',
        data: cycle,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/cycles/:id
   */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.role === 'ADMIN' ? req.user.userId : undefined;
      const cycle = await CycleService.delete(Number(req.params.id), adminId);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.UPDATE_CYCLE,
          ENTITIES.REVENUE_CYCLE,
          String(req.params.id),
          cycle as unknown as Record<string, unknown>,
          null
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.deleted') : 'Revenue cycle deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/cycles/exchange-rate
   * Fetch current USD/VND exchange rate from webgia.com
   */
  static async getExchangeRate(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ExchangeRateService.fetchRate();

      const t = (_req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('cycle.exchangeRateFetched') : 'Exchange rate fetched',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
