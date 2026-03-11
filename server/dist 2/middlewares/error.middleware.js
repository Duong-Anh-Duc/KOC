"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.ApiError = void 0;
const youtube_scraper_service_1 = require("../services/youtube-scraper.service");
class ApiError extends Error {
    statusCode;
    isOperational;
    constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, _next) => {
    const t = req.t;
    if (err instanceof ApiError) {
        const message = t ? t(err.message, { defaultValue: err.message }) : err.message;
        res.status(err.statusCode).json({
            success: false,
            message,
        });
        return;
    }
    // Khi bất kỳ service nào throw NOT_LOGGED_IN → xóa sentinel ngay, trả 401
    if (err.message === 'NOT_LOGGED_IN') {
        const adminId = req.user?.userId;
        youtube_scraper_service_1.YouTubeScraperService.markSessionDisconnected('not_logged_in', undefined, adminId, {
            trigger: 'error_middleware',
            httpMethod: req.method,
            httpPath: req.originalUrl,
            stack: err.stack?.split('\n').slice(0, 5).join(' | ') ?? '',
        }).catch(() => { });
        res.status(401).json({
            success: false,
            message: 'Phiên YouTube Studio đã hết hạn. Vui lòng kết nối lại.',
            code: 'NOT_LOGGED_IN',
        });
        return;
    }
    console.error('❌ Unhandled Error:', err);
    const fallback = t ? t('general.serverError') : 'Internal server error';
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development'
            ? err.message
            : fallback,
    });
};
exports.errorHandler = errorHandler;
/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
    const t = req.t;
    const message = t
        ? t('general.notFound', { method: req.method, url: req.originalUrl })
        : `Route ${req.method} ${req.originalUrl} not found`;
    res.status(404).json({
        success: false,
        message,
    });
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=error.middleware.js.map