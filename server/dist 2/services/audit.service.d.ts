export declare class AuditLogService {
    /**
     * Create audit log entry
     */
    static log(userId: string | null, action: string, entity: string, entityId: string, oldValue?: Record<string, unknown> | null, newValue?: Record<string, unknown> | null): Promise<{
        timestamp: Date;
        id: string;
        action: string;
        entity: string;
        entity_id: string;
        old_value: import("@prisma/client/runtime/library").JsonValue | null;
        new_value: import("@prisma/client/runtime/library").JsonValue | null;
        user_id: string | null;
    }>;
    /**
     * Get audit logs with pagination
     */
    static getLogs(options: {
        page?: number;
        limit?: number;
        entity?: string;
        action?: string;
        entityId?: string;
        userId?: string;
    }): Promise<{
        data: ({
            user: {
                full_name: string;
                email: string;
            } | null;
        } & {
            timestamp: Date;
            id: string;
            action: string;
            entity: string;
            entity_id: string;
            old_value: import("@prisma/client/runtime/library").JsonValue | null;
            new_value: import("@prisma/client/runtime/library").JsonValue | null;
            user_id: string | null;
        })[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
}
//# sourceMappingURL=audit.service.d.ts.map