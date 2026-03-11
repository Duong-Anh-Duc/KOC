"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const services_1 = require("../services");
class AuthController {
    /**
     * POST /api/auth/login
     */
    static async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await services_1.AuthService.login(email, password);
            const t = req.t;
            res.status(200).json({
                success: true,
                message: t ? t('auth.loginSuccess') : 'Login successful',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/auth/register (Admin only)
     */
    static async register(req, res, next) {
        try {
            const { email, password, full_name, role } = req.body;
            const user = await services_1.AuthService.register(email, password, full_name, role);
            const t = req.t;
            res.status(201).json({
                success: true,
                message: t ? t('auth.registerSuccess') : 'User registered successfully',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /api/kocs/:id/account (Admin only) - Create a user account for a KOC
     */
    static async createKocAccount(req, res, next) {
        try {
            const id = req.params.id;
            const { email, password } = req.body;
            const user = await services_1.AuthService.createKocAccount(id, email, password);
            const t = req.t;
            res.status(201).json({
                success: true,
                message: t ? t('auth.kocAccountCreated') : 'KOC account created successfully',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /api/auth/profile
     */
    static async getProfile(req, res, next) {
        try {
            const t = req.t;
            if (!req.user) {
                res.status(401).json({ success: false, message: t ? t('auth.unauthorized') : 'Unauthorized' });
                return;
            }
            const user = await services_1.AuthService.getProfile(req.user.userId);
            res.status(200).json({
                success: true,
                message: t ? t('auth.profileRetrieved') : 'Profile retrieved',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map