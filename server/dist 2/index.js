"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config");
const database_1 = __importDefault(require("./config/database"));
const logger_middleware_1 = __importDefault(require("./middlewares/logger.middleware"));
const cron_service_1 = require("./services/cron.service");
const exchange_rate_service_1 = require("./services/exchange-rate.service");
const youtube_scraper_service_1 = require("./services/youtube-scraper.service");
// Get local IP address
const getLocalIP = () => {
    const interfaces = (0, os_1.networkInterfaces)();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
};
const startServer = async () => {
    try {
        // Test database connection
        await database_1.default.$connect();
        logger_middleware_1.default.info('✅ Database connected successfully');
        const localIP = getLocalIP();
        app_1.default.listen(config_1.config.port, '0.0.0.0', () => {
            logger_middleware_1.default.info(`🚀 Server running on port ${config_1.config.port}`);
            logger_middleware_1.default.info(`📍 Environment: ${config_1.config.env}`);
            logger_middleware_1.default.info(`🔗 API: http://localhost:${config_1.config.port}/api`);
            logger_middleware_1.default.info(`🌐 Network API: http://${localIP}:${config_1.config.port}/api`);
            logger_middleware_1.default.info(`❤️  Health: http://localhost:${config_1.config.port}/api/health`);
            // Start cron scheduler for all admins
            cron_service_1.CronService.startAllSchedulers().catch(err => {
                logger_middleware_1.default.warn('⚠️ Failed to start cron scheduler:', err.message);
            });
            // Start exchange rate auto-refresher (every 10 minutes)
            exchange_rate_service_1.ExchangeRateService.startRateRefresher();
            // Restore YouTube Studio sessions (launches headless browsers with keep-alive)
            youtube_scraper_service_1.YouTubeScraperService.initializePersistentSessions().catch(err => {
                logger_middleware_1.default.warn('⚠️ Failed to initialize YouTube sessions:', err.message);
            });
        });
    }
    catch (error) {
        logger_middleware_1.default.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_middleware_1.default.info('SIGTERM received. Shutting down...');
    await database_1.default.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_middleware_1.default.info('SIGINT received. Shutting down...');
    await database_1.default.$disconnect();
    process.exit(0);
});
startServer();
//# sourceMappingURL=index.js.map