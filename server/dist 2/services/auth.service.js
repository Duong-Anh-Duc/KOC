"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const database_1 = __importDefault(require("../config/database"));
const middlewares_1 = require("../middlewares");
class AuthService {
    /**
     * Login with email and password
     */
    static async login(email, password) {
        const user = await database_1.default.user.findUnique({ where: { email } });
        if (!user || !user.is_active) {
            throw new middlewares_1.ApiError(401, 'auth.loginFailed');
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw new middlewares_1.ApiError(401, 'auth.loginFailed');
        }
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            ...(user.koc_id ? { kocId: user.koc_id } : {}),
        };
        const token = jsonwebtoken_1.default.sign(payload, config_1.config.jwt.secret, {
            expiresIn: config_1.config.jwt.expiresIn,
        });
        return {
            token,
            user: {
                userId: user.id,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                ...(user.koc_id ? { kocId: user.koc_id } : {}),
            },
        };
    }
    /**
     * Register a new user (Admin only operation)
     */
    static async register(email, password, fullName, role = client_1.UserRole.ACCOUNTANT) {
        const existingUser = await database_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new middlewares_1.ApiError(409, 'auth.emailExists');
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await database_1.default.user.create({
            data: {
                email,
                password_hash: passwordHash,
                full_name: fullName,
                role,
            },
            select: {
                id: true,
                email: true,
                full_name: true,
                role: true,
                created_at: true,
            },
        });
        return user;
    }
    /**
     * Create a user account for a KOC (Admin only)
     */
    static async createKocAccount(kocId, email, password) {
        // Verify KOC exists
        const koc = await database_1.default.kOC.findUnique({ where: { id: kocId } });
        if (!koc) {
            throw new middlewares_1.ApiError(404, 'koc.notFound');
        }
        // Check if KOC already has an account
        const existingLink = await database_1.default.user.findFirst({ where: { koc_id: kocId } });
        if (existingLink) {
            throw new middlewares_1.ApiError(409, 'auth.kocAccountExists');
        }
        // Check email uniqueness
        const existingUser = await database_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new middlewares_1.ApiError(409, 'auth.emailExists');
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await database_1.default.user.create({
            data: {
                email,
                password_hash: passwordHash,
                full_name: koc.full_name,
                role: client_1.UserRole.KOC,
                koc_id: kocId,
            },
            select: {
                id: true,
                email: true,
                full_name: true,
                role: true,
                koc_id: true,
                created_at: true,
            },
        });
        return user;
    }
    /**
     * Get current user info
     */
    static async getProfile(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                full_name: true,
                role: true,
                is_active: true,
                koc_id: true,
                created_at: true,
            },
        });
        if (!user) {
            throw new middlewares_1.ApiError(404, 'auth.userNotFound');
        }
        return user;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map