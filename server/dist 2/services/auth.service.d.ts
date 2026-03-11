import { UserRole } from '@prisma/client';
import { JwtPayload } from '../types';
export declare class AuthService {
    /**
     * Login with email and password
     */
    static login(email: string, password: string): Promise<{
        token: string;
        user: Omit<JwtPayload, 'iat' | 'exp'> & {
            full_name: string;
        };
    }>;
    /**
     * Register a new user (Admin only operation)
     */
    static register(email: string, password: string, fullName: string, role?: UserRole): Promise<{
        full_name: string;
        email: string;
        id: string;
        created_at: Date;
        role: import(".prisma/client").$Enums.UserRole;
    }>;
    /**
     * Create a user account for a KOC (Admin only)
     */
    static createKocAccount(kocId: string, email: string, password: string): Promise<{
        full_name: string;
        email: string;
        id: string;
        created_at: Date;
        koc_id: string | null;
        role: import(".prisma/client").$Enums.UserRole;
    }>;
    /**
     * Get current user info
     */
    static getProfile(userId: string): Promise<{
        full_name: string;
        email: string;
        id: string;
        created_at: Date;
        koc_id: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        is_active: boolean;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map