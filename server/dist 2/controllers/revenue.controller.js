"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueController = void 0;
const constants_1 = require("../constants");
const services_1 = require("../services");
class RevenueController {
    /**
     * GET /api/revenue/records?cycle_id=X
     */
    static async getRecordsByCycle(req, res, next) {
        try {
            const cycleId = Number(req.query.cycle_id);
            const t = req.t;
            if (!cycleId) {
                res.status(400).json({ success: false, message: t ? t('validation.cycleIdRequired') : 'cycle_id is required' });
                return;
            }
            const authReq = req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const result = await services_1.RevenueService.getRecordsByCycle(cycleId, undefined, adminId);
            res.status(200).json({
                success: true,
                message: t ? t('revenue.recordsRetrieved') : 'Revenue records retrieved',
                data: result.records,
                totals: result.totals,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/revenue/records/:id
     */
    static async getRecordById(req, res, next) {
        try {
            const record = await services_1.RevenueService.getRecordById(req.params.id);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('revenue.recordRetrieved') : 'Revenue record retrieved',
                data: record,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/revenue/records
     */
    static async createRecord(req, res, next) {
        try {
            const { koc_id, cycle_id, original_revenue_usd, us_tax_deduction } = req.body;
            const record = await services_1.RevenueService.createRecord(koc_id, cycle_id, original_revenue_usd, us_tax_deduction, req.user?.userId);
            // Audit log
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.CREATE_REVENUE_RECORD, constants_1.ENTITIES.REVENUE_RECORD, record.id, null, record);
            }
            const t = req.t;
            res.status(201).json({
                success: true,
                message: t ? t('revenue.recordCreated') : 'Revenue record created',
                data: record,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PUT /api/revenue/records/:id
     */
    static async updateRecord(req, res, next) {
        try {
            const { original_revenue_usd, us_tax_deduction } = req.body;
            const { record, oldValue } = await services_1.RevenueService.updateRecord(req.params.id, original_revenue_usd, us_tax_deduction, req.user?.userId);
            // Audit log
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.UPDATE_REVENUE_RECORD, constants_1.ENTITIES.REVENUE_RECORD, record.id, oldValue, record);
            }
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('revenue.recordUpdated') : 'Revenue record updated',
                data: record,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/revenue/records/bulk
     */
    static async bulkCreateRecords(req, res, next) {
        try {
            const { cycle_id, records } = req.body;
            const result = await services_1.RevenueService.bulkCreateRecords(cycle_id, records, req.user?.userId);
            // Audit log for each record
            if (req.user) {
                for (const item of result) {
                    if (item.isNew) {
                        // Tạo mới
                        await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.CREATE_REVENUE_RECORD, constants_1.ENTITIES.REVENUE_RECORD, item.record.id, null, item.record);
                    }
                    else {
                        // Cập nhật
                        await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.UPDATE_REVENUE_RECORD, constants_1.ENTITIES.REVENUE_RECORD, item.record.id, item.oldValue, item.record);
                    }
                }
            }
            const t = req.t;
            const created = result.filter(r => r.isNew).length;
            const updated = result.length - created;
            res.status(201).json({
                success: true,
                message: t
                    ? t('revenue.bulkCreated', { count: result.length })
                    : `${created} created, ${updated} updated`,
                data: result.map(r => r.record),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * DELETE /api/revenue/records/:id
     */
    static async deleteRecord(req, res, next) {
        try {
            const record = await services_1.RevenueService.deleteRecord(req.params.id);
            // Audit log
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.DELETE_REVENUE_RECORD, constants_1.ENTITIES.REVENUE_RECORD, req.params.id, record, null);
            }
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('revenue.recordDeleted') : 'Revenue record deleted',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * DELETE /api/revenue/records/bulk
     * Body: { ids: string[] }
     */
    static async bulkDeleteRecords(req, res, next) {
        try {
            const { ids } = req.body;
            const t = req.t;
            if (!Array.isArray(ids) || ids.length === 0) {
                res.status(400).json({ success: false, message: 'ids array is required' });
                return;
            }
            const result = await services_1.RevenueService.bulkDeleteRecords(ids);
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.DELETE_REVENUE_RECORD, constants_1.ENTITIES.REVENUE_RECORD, 'bulk', { ids }, null);
            }
            res.status(200).json({
                success: true,
                message: t ? t('revenue.recordsDeleted', { count: result.deleted }) : `${result.deleted} records deleted`,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * PATCH /api/revenue/records/:id/approve
     */
    static async approveRecord(req, res, next) {
        try {
            const record = await services_1.RevenueService.approveRecord(req.params.id);
            if (req.user) {
                await services_1.AuditLogService.log(req.user.userId, constants_1.AUDIT_ACTIONS.APPROVE_REVENUE_RECORD, constants_1.ENTITIES.REVENUE_RECORD, record.id, { status: 'PENDING' }, { status: 'APPROVED' });
            }
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('revenue.recordApproved') : 'Revenue record approved',
                data: record,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/revenue/calculate (preview calculation without saving)
     */
    static async previewCalculation(req, res, next) {
        try {
            const { original_revenue_usd, us_tax_deduction, base_rate, exchange_rate } = req.body;
            const result = services_1.RevenueService.calculate({
                originalRevenueUsd: original_revenue_usd,
                usTaxDeduction: us_tax_deduction,
                baseRate: base_rate || 0.8,
                exchangeRate: exchange_rate || 25400,
            });
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('revenue.calculationPreview') : 'Calculation preview',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/revenue/payment-status?cycle_id=X
     * Returns accumulated balance / $100 threshold status for each KOC
     */
    static async getPaymentStatus(req, res, next) {
        try {
            const cycleId = Number(req.query.cycle_id);
            const t = req.t;
            if (!cycleId) {
                res.status(400).json({ success: false, message: t ? t('validation.cycleIdRequired') : 'cycle_id is required' });
                return;
            }
            const authReq = req;
            const adminId = authReq.user?.role === 'ADMIN' ? authReq.user.userId : undefined;
            const paymentStatus = await services_1.RevenueService.getPaymentStatus(cycleId, adminId);
            res.status(200).json({
                success: true,
                message: t ? t('revenue.paymentStatusRetrieved') : 'Payment status retrieved',
                data: paymentStatus,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.RevenueController = RevenueController;
//# sourceMappingURL=revenue.controller.js.map