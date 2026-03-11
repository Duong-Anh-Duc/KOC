"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueService = void 0;
const database_1 = __importDefault(require("../config/database"));
const constants_1 = require("../constants");
const middlewares_1 = require("../middlewares");
class RevenueService {
    /**
     * Core revenue calculation formula
     *
     * 1. Bank Fee = ((Original - US_Tax) * 0.25%) + $12
     * 2. Net Revenue = Original - US_Tax - Bank_Fee
     * 3. Company Share = Net * (1 - base_rate)
     * 4. KOC Gross = Net * base_rate (default 80%)
     * 5. KOC Tax = KOC_Gross * 10%
     * 6. Final USD = KOC_Gross - KOC_Tax
     * 7. Final VND = Final_USD * Exchange_Rate
     */
    static calculate(input) {
        const { originalRevenueUsd, usTaxDeduction, baseRate, exchangeRate } = input;
        // Step 1: Bank Fee
        // If net-before-fee is less than or equal to bank fee, waive bank fee entirely (avoid negative net)
        const netBeforeFee = originalRevenueUsd - usTaxDeduction;
        const rawBankFee = (netBeforeFee * constants_1.REVENUE_CONSTANTS.BANK_FEE_RATE) + constants_1.REVENUE_CONSTANTS.BANK_FEE_FIXED;
        const bankFee = netBeforeFee <= rawBankFee ? 0 : rawBankFee;
        // Step 2: Net Revenue (after US tax and bank fee)
        const netRevenue = netBeforeFee - bankFee;
        // Step 3: Company Share (EBE)
        const companyRate = 1 - baseRate;
        const companyShare = netRevenue * companyRate;
        // Step 4: KOC Gross Share
        const kocShareGross = netRevenue * baseRate;
        // Step 5: KOC Personal Income Tax (10%)
        const kocTaxDeduction = kocShareGross * constants_1.REVENUE_CONSTANTS.KOC_TAX_RATE;
        // Step 6: Final USD
        const kocReceiveUsd = kocShareGross - kocTaxDeduction;
        // Step 7: Final VND
        const kocReceiveVnd = kocReceiveUsd * exchangeRate;
        return {
            original_revenue_usd: RevenueService.round2(originalRevenueUsd),
            us_tax_deduction: RevenueService.round2(usTaxDeduction),
            bank_fee: RevenueService.round2(bankFee),
            net_revenue: RevenueService.round2(netRevenue),
            company_share: RevenueService.round2(companyShare),
            koc_share_gross: RevenueService.round2(kocShareGross),
            koc_tax_deduction: RevenueService.round2(kocTaxDeduction),
            koc_receive_usd: RevenueService.round2(kocReceiveUsd),
            koc_receive_vnd: RevenueService.round2(kocReceiveVnd),
        };
    }
    /**
     * Create a revenue record for a KOC in a specific cycle
     */
    static async createRecord(kocId, cycleId, originalRevenueUsd, usTaxDeduction, adminId) {
        // Get KOC base rate
        const koc = await database_1.default.kOC.findUnique({ where: { id: kocId } });
        if (!koc)
            throw new middlewares_1.ApiError(404, 'koc.notFound');
        // Get cycle exchange rate
        const cycle = await database_1.default.revenueCycle.findUnique({ where: { id: cycleId } });
        if (!cycle)
            throw new middlewares_1.ApiError(404, 'cycle.notFound');
        if (cycle.status !== 'OPEN')
            throw new middlewares_1.ApiError(400, 'revenue.cycleLocked');
        // Check duplicate
        const existing = await database_1.default.revenueRecord.findUnique({
            where: { koc_id_cycle_id: { koc_id: kocId, cycle_id: cycleId } },
        });
        if (existing)
            throw new middlewares_1.ApiError(409, 'revenue.recordExists');
        // Calculate all fields
        const calculated = RevenueService.calculate({
            originalRevenueUsd,
            usTaxDeduction,
            baseRate: Number(koc.base_rate),
            exchangeRate: Number(cycle.exchange_rate),
        });
        // Create record
        const record = await database_1.default.revenueRecord.create({
            data: {
                koc_id: kocId,
                cycle_id: cycleId,
                ...calculated,
            },
            include: {
                koc: { select: { full_name: true, channel_name: true, pub_code: true } },
                cycle: { select: { month: true, exchange_rate: true } },
            },
        });
        return record;
    }
    /**
     * Update a revenue record (recalculates all derived fields)
     */
    static async updateRecord(recordId, originalRevenueUsd, usTaxDeduction, adminId) {
        const record = await database_1.default.revenueRecord.findUnique({
            where: { id: recordId },
            include: { koc: true, cycle: true },
        });
        if (!record)
            throw new middlewares_1.ApiError(404, 'revenue.recordNotFound');
        if (record.cycle.status !== 'OPEN')
            throw new middlewares_1.ApiError(400, 'revenue.cycleLocked');
        const newOriginal = originalRevenueUsd ?? Number(record.original_revenue_usd);
        const newTax = usTaxDeduction ?? Number(record.us_tax_deduction);
        const calculated = RevenueService.calculate({
            originalRevenueUsd: newOriginal,
            usTaxDeduction: newTax,
            baseRate: Number(record.koc.base_rate),
            exchangeRate: Number(record.cycle.exchange_rate),
        });
        const oldValue = {
            original_revenue_usd: Number(record.original_revenue_usd),
            us_tax_deduction: Number(record.us_tax_deduction),
            koc_receive_usd: Number(record.koc_receive_usd),
            koc_receive_vnd: Number(record.koc_receive_vnd),
        };
        const updated = await database_1.default.revenueRecord.update({
            where: { id: recordId },
            data: { ...calculated },
            include: {
                koc: { select: { full_name: true, channel_name: true, pub_code: true } },
                cycle: { select: { month: true, exchange_rate: true } },
            },
        });
        return { record: updated, oldValue };
    }
    /**
     * Bulk create revenue records for a cycle
     */
    static async bulkCreateRecords(cycleId, records, adminId) {
        const cycle = await database_1.default.revenueCycle.findUnique({ where: { id: cycleId } });
        if (!cycle)
            throw new middlewares_1.ApiError(404, 'revenue.cycleNotFound');
        if (cycle.status !== 'OPEN')
            throw new middlewares_1.ApiError(400, 'revenue.cycleLocked');
        const results = [];
        for (const item of records) {
            const koc = await database_1.default.kOC.findUnique({ where: { id: item.koc_id } });
            if (!koc)
                continue;
            // Check if record already exists
            const existing = await database_1.default.revenueRecord.findUnique({
                where: { koc_id_cycle_id: { koc_id: item.koc_id, cycle_id: cycleId } },
            });
            const calculated = RevenueService.calculate({
                originalRevenueUsd: item.original_revenue_usd,
                usTaxDeduction: item.us_tax_deduction,
                baseRate: Number(koc.base_rate),
                exchangeRate: Number(cycle.exchange_rate),
            });
            const record = await database_1.default.revenueRecord.upsert({
                where: { koc_id_cycle_id: { koc_id: item.koc_id, cycle_id: cycleId } },
                update: { ...calculated },
                create: { koc_id: item.koc_id, cycle_id: cycleId, ...calculated },
            });
            results.push({ record, isNew: !existing, oldValue: existing });
        }
        return results;
    }
    /**
     * Get all records for a specific cycle
     * @param statusFilter - Optional filter: 'APPROVED' | 'PENDING' to get only records with that status
     */
    static async getRecordsByCycle(cycleId, statusFilter, adminId) {
        // Build KOC filter for admin scoping
        const kocFilter = adminId ? { koc: { admin_id: adminId } } : {};
        const records = await database_1.default.revenueRecord.findMany({
            where: {
                cycle_id: cycleId,
                ...(statusFilter ? { status: statusFilter } : {}),
                ...kocFilter,
            },
            include: {
                koc: {
                    select: {
                        full_name: true,
                        channel_name: true,
                        bank_account_number: true,
                        bank_name: true,
                        base_rate: true,
                    },
                },
                cycle: {
                    select: { month: true, exchange_rate: true, status: true },
                },
            },
            orderBy: { koc: { full_name: 'asc' } },
        });
        // Dynamically compute accumulated from previous PENDING cycles (not from stored DB value)
        const kocIds = records.map(r => r.koc_id);
        const prevPendingRecords = kocIds.length > 0
            ? await database_1.default.revenueRecord.findMany({
                where: { koc_id: { in: kocIds }, status: 'PENDING', cycle_id: { lt: cycleId } },
            })
            : [];
        // Sum previous PENDING revenue per KOC
        const prevOriginalByKoc = new Map();
        const prevUsTaxByKoc = new Map();
        for (const r of prevPendingRecords) {
            prevOriginalByKoc.set(r.koc_id, (prevOriginalByKoc.get(r.koc_id) ?? 0) + Number(r.original_revenue_usd));
            prevUsTaxByKoc.set(r.koc_id, (prevUsTaxByKoc.get(r.koc_id) ?? 0) + Number(r.us_tax_deduction));
        }
        // Recalculate ALL derived fields from accumulated total.
        // Bank fee ($12 fixed) is charged once on the total, not per month.
        const enrichedRecords = records.map(r => {
            const prevOrig = prevOriginalByKoc.get(r.koc_id) ?? 0;
            const prevTax = prevUsTaxByKoc.get(r.koc_id) ?? 0;
            const accRevenue = RevenueService.round2(prevOrig + Number(r.original_revenue_usd));
            const accUsTax = RevenueService.round2(prevTax + Number(r.us_tax_deduction));
            const accCalc = RevenueService.calculate({
                originalRevenueUsd: accRevenue,
                usTaxDeduction: accUsTax,
                baseRate: Number(r.koc.base_rate ?? 0.8),
                exchangeRate: Number(r.cycle.exchange_rate),
            });
            return {
                ...r,
                accumulated_revenue_usd: accRevenue,
                accumulated_us_tax: accCalc.us_tax_deduction,
                accumulated_bank_fee: accCalc.bank_fee,
                accumulated_net_revenue: accCalc.net_revenue,
                accumulated_company_share: accCalc.company_share,
                accumulated_koc_gross: accCalc.koc_share_gross,
                accumulated_koc_tax: accCalc.koc_tax_deduction,
                accumulated_koc_usd: accCalc.koc_receive_usd,
                accumulated_koc_vnd: accCalc.koc_receive_vnd,
            };
        });
        // Totals always use accumulated values
        const totals = enrichedRecords.reduce((acc, r) => {
            return {
                totalOriginal: acc.totalOriginal + Number(r.original_revenue_usd),
                totalNetRevenue: acc.totalNetRevenue + Number(r.accumulated_net_revenue),
                totalCompanyShare: acc.totalCompanyShare + Number(r.accumulated_company_share),
                totalKocReceiveUsd: acc.totalKocReceiveUsd + Number(r.accumulated_koc_usd),
                totalKocReceiveVnd: acc.totalKocReceiveVnd + Number(r.accumulated_koc_vnd),
                totalAccumulatedKocUsd: acc.totalAccumulatedKocUsd + Number(r.accumulated_koc_usd),
                totalAccumulatedKocVnd: acc.totalAccumulatedKocVnd + Number(r.accumulated_koc_vnd),
            };
        }, {
            totalOriginal: 0,
            totalNetRevenue: 0,
            totalCompanyShare: 0,
            totalKocReceiveUsd: 0,
            totalKocReceiveVnd: 0,
            totalAccumulatedKocUsd: 0,
            totalAccumulatedKocVnd: 0,
        });
        return { records: enrichedRecords, totals };
    }
    /**
     * Get revenue record by ID
     */
    static async getRecordById(recordId) {
        const record = await database_1.default.revenueRecord.findUnique({
            where: { id: recordId },
            include: {
                koc: true,
                cycle: true,
            },
        });
        if (!record)
            throw new middlewares_1.ApiError(404, 'revenue.recordNotFound');
        return record;
    }
    /**
     * Delete a revenue record
     */
    static async deleteRecord(recordId) {
        const record = await database_1.default.revenueRecord.findUnique({
            where: { id: recordId },
            include: { cycle: true },
        });
        if (!record)
            throw new middlewares_1.ApiError(404, 'revenue.recordNotFound');
        if (record.cycle.status !== 'OPEN')
            throw new middlewares_1.ApiError(400, 'revenue.cannotDeleteFromLocked');
        await database_1.default.revenueRecord.delete({ where: { id: recordId } });
        return record;
    }
    /**
     * Bulk delete revenue records by IDs (all must belong to OPEN cycles)
     */
    static async bulkDeleteRecords(ids) {
        if (!ids || ids.length === 0)
            return { deleted: 0 };
        // Validate all records exist and belong to OPEN cycles
        const records = await database_1.default.revenueRecord.findMany({
            where: { id: { in: ids } },
            include: { cycle: true },
        });
        for (const record of records) {
            if (record.cycle.status !== 'OPEN') {
                throw new middlewares_1.ApiError(400, 'revenue.cannotDeleteFromLocked');
            }
        }
        await database_1.default.revenueRecord.deleteMany({ where: { id: { in: ids } } });
        return { deleted: records.length };
    }
    /**
     * Approve a revenue record.
     * Approves this record AND all previous PENDING records for the same KOC
     * (since threshold was accumulated across months). paid_in_cycle_id is set
     * to the current record's cycle_id to mark where payment was finalized.
     */
    static async approveRecord(recordId) {
        const record = await database_1.default.revenueRecord.findUnique({
            where: { id: recordId },
            include: { cycle: true },
        });
        if (!record)
            throw new middlewares_1.ApiError(404, 'revenue.recordNotFound');
        // Check threshold
        const paymentStatus = await RevenueService.getPaymentStatus(record.cycle_id);
        const kocStatus = paymentStatus[record.koc_id];
        if (kocStatus?.belowThreshold) {
            throw new middlewares_1.ApiError(400, 'revenue.belowThreshold');
        }
        // Approve ALL pending records for this KOC (current + previous cycles)
        await database_1.default.revenueRecord.updateMany({
            where: { koc_id: record.koc_id, status: 'PENDING' },
            data: { status: 'APPROVED', paid_in_cycle_id: record.cycle_id },
        });
        // Return the now-approved current record
        return { ...record, status: 'APPROVED', paid_in_cycle_id: record.cycle_id };
    }
    /**
     * Get payment status for each record in a cycle.
     * Uses per-KOC min_payment threshold. Accumulates original_revenue_usd across months.
     * When a cycle is PAYMENT_COMPLETED, records in that cycle are considered paid → reset accumulation.
     * Returns map of koc_id -> { accumulated, belowThreshold, accumulatedMonths, threshold }
     */
    static async getPaymentStatus(cycleId, adminId) {
        const cycle = await database_1.default.revenueCycle.findUnique({ where: { id: cycleId } });
        if (!cycle)
            throw new middlewares_1.ApiError(404, 'cycle.notFound');
        // Get all cycles ordered by month for comparison
        const allCycles = await database_1.default.revenueCycle.findMany({
            orderBy: { month: 'asc' },
        });
        // Find cycles before (and including) current cycle
        const currentIdx = allCycles.findIndex(c => c.id === cycleId);
        const relevantCycles = allCycles.slice(0, currentIdx + 1);
        // Get all records for relevant cycles (scoped to admin's KOCs)
        const kocFilter = adminId ? { koc: { admin_id: adminId } } : {};
        const records = await database_1.default.revenueRecord.findMany({
            where: { cycle_id: { in: relevantCycles.map(c => c.id) }, ...kocFilter },
            include: { cycle: true },
            orderBy: { cycle: { month: 'asc' } },
        });
        // Build cycle status map (to know which cycles are PAYMENT_COMPLETED)
        const cycleStatusMap = new Map();
        for (const c of allCycles) {
            cycleStatusMap.set(c.id, c.status);
        }
        // Get all KOCs with their min_payment
        const kocIds = [...new Set(records.map(r => r.koc_id))];
        const kocs = await database_1.default.kOC.findMany({
            where: { id: { in: kocIds } },
            select: { id: true, min_payment: true },
        });
        const kocThresholdMap = new Map();
        for (const koc of kocs) {
            kocThresholdMap.set(koc.id, Number(koc.min_payment));
        }
        // Group records by KOC
        const kocRecords = new Map();
        for (const record of records) {
            const entries = kocRecords.get(record.koc_id) || [];
            entries.push({
                cycleId: record.cycle_id,
                revenue: Number(record.original_revenue_usd),
                month: record.cycle.month,
                status: record.status,
                cycleStatus: cycleStatusMap.get(record.cycle_id) || 'OPEN',
            });
            kocRecords.set(record.koc_id, entries);
        }
        // Calculate accumulated balance for each KOC
        const result = {};
        for (const [kocId, entries] of kocRecords) {
            const threshold = kocThresholdMap.get(kocId) ?? constants_1.REVENUE_CONSTANTS.MIN_PAYMENT_THRESHOLD;
            let accumulated = 0;
            const accumulatedMonths = [];
            for (const entry of entries) {
                if (entry.status === 'APPROVED') {
                    // APPROVED means this KOC's revenue was settled up to this point → reset running total.
                    // This covers both: manual approval (cycle still OPEN/LOCKED) and payment completion.
                    accumulated = 0;
                    accumulatedMonths.length = 0;
                }
                else {
                    // PENDING → keep accumulating into the unpaid balance
                    accumulated += entry.revenue;
                    accumulatedMonths.push({ month: entry.month, revenue: entry.revenue });
                }
            }
            result[kocId] = {
                accumulated: RevenueService.round2(accumulated),
                belowThreshold: accumulated < threshold,
                accumulatedMonths,
                threshold,
            };
        }
        return result;
    }
    /** Round to 2 decimal places */
    static round2(value) {
        return Math.round(value * 100) / 100;
    }
}
exports.RevenueService = RevenueService;
//# sourceMappingURL=revenue.service.js.map