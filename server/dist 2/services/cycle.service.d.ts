export declare class CycleService {
    /**
     * Get all revenue cycles — scoped by admin_id
     */
    static getAll(adminId?: string): Promise<any>;
    /**
     * Get cycle by ID with records summary — checks admin ownership
     */
    static getById(id: number, adminId?: string): Promise<any>;
    /**
     * Create a new revenue cycle — tied to admin
     */
    static create(month: string, exchangeRate: number, adminId?: string): Promise<any>;
    /**
     * Update a revenue cycle — checks admin ownership
     */
    static update(id: number, data: {
        exchange_rate?: number;
        status?: 'OPEN' | 'LOCKED' | 'PAYMENT_COMPLETED';
    }, adminId?: string): Promise<any>;
    /**
     * Add KOC(s) to an existing cycle with empty ($0) revenue records.
     * If kocIds is omitted, adds ALL active KOCs not yet in the cycle.
     * Already-added KOCs are silently skipped (no duplicate error).
     */
    static addKocs(cycleId: number, kocIds?: string[], adminId?: string): Promise<{
        added: number;
        skipped: number;
    }>;
    /**
     * Lock a cycle (prevent further edits) — checks admin ownership
     */
    static lock(id: number, adminId?: string): Promise<any>;
    /**
     * Reopen a LOCKED or PAYMENT_COMPLETED cycle back to OPEN — checks admin ownership
     */
    static reopen(id: number, adminId?: string): Promise<any>;
    /**
     * Mark cycle as payment completed — checks admin ownership.
     * Approves ALL PENDING records (current + previous cycles) for KOCs that have
     * reached their min_payment threshold. Below-threshold KOCs stay PENDING and
     * will keep accumulating to the next cycle.
     */
    static complete(id: number, adminId?: string): Promise<any>;
    /**
     * Delete a cycle (only if OPEN and no records) — checks admin ownership
     */
    static delete(id: number, adminId?: string): Promise<any>;
}
//# sourceMappingURL=cycle.service.d.ts.map