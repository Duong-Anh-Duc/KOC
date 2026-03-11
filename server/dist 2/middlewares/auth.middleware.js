"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOrAccountant = exports.adminOnly = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
/**
 * Middleware to verify JWT token and attach user to request
 */
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: req.t?.('auth.tokenRequired') || 'Authentication token is required',
            });
            return;
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
        req.user = decoded;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                success: false,
                message: req.t?.('auth.tokenExpired') || 'Token has expired',
            });
            return;
        }
        res.status(401).json({
            success: false,
            message: req.t?.('auth.invalidToken') || 'Invalid authentication token',
        });
    }
};
exports.authMiddleware = authMiddleware;
/**
 * Middleware to require ADMIN role
 */
const adminOnly = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: req.t?.('auth.authRequired') || 'Authentication required',
        });
        return;
    }
    if (req.user.role !== 'ADMIN') {
        res.status(403).json({
            success: false,
            message: req.t?.('auth.adminOnly') || 'Admin access required',
        });
        return;
    }
    next();
};
exports.adminOnly = adminOnly;
/**
 * Middleware to block KOC role (allow ADMIN & ACCOUNTANT only)
 */
const adminOrAccountant = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: req.t?.('auth.authRequired') || 'Authentication required',
        });
        return;
    }
    if (req.user.role === 'KOC') {
        res.status(403).json({
            success: false,
            message: req.t?.('auth.staffOnly') || 'Staff access required',
        });
        return;
    }
    next();
};
exports.adminOrAccountant = adminOrAccountant;
//# sourceMappingURL=auth.middleware.js.map