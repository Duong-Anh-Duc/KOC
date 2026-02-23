import { NextFunction, Request, Response } from 'express';
import { AUDIT_ACTIONS, ENTITIES } from '../constants';
import { AuditLogService, RevenueService } from '../services';
import { AuthenticatedRequest } from '../types';

export class RevenueController {
  /**
   * GET /api/revenue/records?cycle_id=X
   */
  static async getRecordsByCycle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cycleId = Number(req.query.cycle_id);
      const t = (req as any).t;
      if (!cycleId) {
        res.status(400).json({ success: false, message: t ? t('validation.cycleIdRequired') : 'cycle_id is required' });
        return;
      }

      const result = await RevenueService.getRecordsByCycle(cycleId);

      res.status(200).json({
        success: true,
        message: t ? t('revenue.recordsRetrieved') : 'Revenue records retrieved',
        data: result.records,
        totals: result.totals,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/revenue/records/:id
   */
  static async getRecordById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await RevenueService.getRecordById(req.params.id as string);

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('revenue.recordRetrieved') : 'Revenue record retrieved',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/revenue/records
   */
  static async createRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { koc_id, cycle_id, original_revenue_usd, us_tax_deduction } = req.body;

      const record = await RevenueService.createRecord(
        koc_id,
        cycle_id,
        original_revenue_usd,
        us_tax_deduction
      );

      // Audit log
      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.CREATE_REVENUE_RECORD,
          ENTITIES.REVENUE_RECORD,
          record.id,
          null,
          record as unknown as Record<string, unknown>
        );
      }

      const t = (req as any).t;
      res.status(201).json({
        success: true,
        message: t ? t('revenue.recordCreated') : 'Revenue record created',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/revenue/records/:id
   */
  static async updateRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { original_revenue_usd, us_tax_deduction } = req.body;

      const { record, oldValue } = await RevenueService.updateRecord(
        req.params.id as string,
        original_revenue_usd,
        us_tax_deduction
      );

      // Audit log
      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.UPDATE_REVENUE_RECORD,
          ENTITIES.REVENUE_RECORD,
          record.id,
          oldValue,
          record as unknown as Record<string, unknown>
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('revenue.recordUpdated') : 'Revenue record updated',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/revenue/records/bulk
   */
  static async bulkCreateRecords(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cycle_id, records } = req.body;

      const result = await RevenueService.bulkCreateRecords(cycle_id, records);

      // Audit log for each record
      if (req.user) {
        for (const item of result) {
          if (item.isNew) {
            // Tạo mới
            await AuditLogService.log(
              req.user.userId,
              AUDIT_ACTIONS.CREATE_REVENUE_RECORD,
              ENTITIES.REVENUE_RECORD,
              item.record.id,
              null,
              item.record as unknown as Record<string, unknown>
            );
          } else {
            // Cập nhật
            await AuditLogService.log(
              req.user.userId,
              AUDIT_ACTIONS.UPDATE_REVENUE_RECORD,
              ENTITIES.REVENUE_RECORD,
              item.record.id,
              item.oldValue as unknown as Record<string, unknown>,
              item.record as unknown as Record<string, unknown>
            );
          }
        }
      }

      const t = (req as any).t;
      const created = result.filter(r => r.isNew).length;
      const updated = result.length - created;
      
      res.status(201).json({
        success: true,
        message: t 
          ? t('revenue.bulkCreated', { count: result.length }) 
          : `${created} created, ${updated} updated`,
        data: result.map(r => r.record),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/revenue/records/:id
   */
  static async deleteRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await RevenueService.deleteRecord(req.params.id as string);
        
      // Audit log
      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.DELETE_REVENUE_RECORD,
          ENTITIES.REVENUE_RECORD,
          req.params.id as string,
          record as unknown as Record<string, unknown>,
          null
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('revenue.recordDeleted') : 'Revenue record deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/revenue/records/:id/approve
   */
  static async approveRecord(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const record = await RevenueService.approveRecord(req.params.id as string);

      if (req.user) {
        await AuditLogService.log(
          req.user.userId,
          AUDIT_ACTIONS.APPROVE_REVENUE_RECORD,
          ENTITIES.REVENUE_RECORD,
          record.id,
          { status: 'PENDING' },
          { status: 'APPROVED' }
        );
      }

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('revenue.recordApproved') : 'Revenue record approved',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/revenue/calculate (preview calculation without saving)
   */
  static async previewCalculation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { original_revenue_usd, us_tax_deduction, base_rate, exchange_rate } = req.body;

      const result = RevenueService.calculate({
        originalRevenueUsd: original_revenue_usd,
        usTaxDeduction: us_tax_deduction,
        baseRate: base_rate || 0.8,
        exchangeRate: exchange_rate || 25400,
      });

      const t = (req as any).t;
      res.status(200).json({
        success: true,
        message: t ? t('revenue.calculationPreview') : 'Calculation preview',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/revenue/payment-status?cycle_id=X
   * Returns accumulated balance / $100 threshold status for each KOC
   */
  static async getPaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cycleId = Number(req.query.cycle_id);
      const t = (req as any).t;
      if (!cycleId) {
        res.status(400).json({ success: false, message: t ? t('validation.cycleIdRequired') : 'cycle_id is required' });
        return;
      }

      const paymentStatus = await RevenueService.getPaymentStatus(cycleId);

      res.status(200).json({
        success: true,
        message: t ? t('revenue.paymentStatusRetrieved') : 'Payment status retrieved',
        data: paymentStatus,
      });
    } catch (error) {
      next(error);
    }
  }
}
