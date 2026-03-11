"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const i18n_1 = require("./i18n");
const middlewares_1 = require("./middlewares");
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
// Trust nginx reverse proxy — reads real client IP from X-Forwarded-For
app.set('trust proxy', 1);
// ============================================================
// SECURITY MIDDLEWARES
// ============================================================
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: config_1.config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
}));
// Rate limiting (per real client IP)
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // limit each IP to 2000 requests per 15 minutes
    message: { success: false, message: 'general.tooManyRequests' },
});
app.use('/api/', limiter);
// ============================================================
// BODY PARSING
// ============================================================
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// ============================================================
// INTERNATIONALIZATION
// ============================================================
app.use(i18n_1.i18nMiddleware);
// ============================================================
// LOGGING
// ============================================================
app.use(middlewares_1.requestLogger);
// ============================================================
// ROUTES
// ============================================================
app.use('/api', routes_1.default);
// ============================================================
// ERROR HANDLING
// ============================================================
app.use(middlewares_1.notFoundHandler);
app.use(middlewares_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map