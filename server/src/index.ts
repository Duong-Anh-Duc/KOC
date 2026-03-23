import { networkInterfaces } from 'os';
import app from './app';
import { config } from './config';
import prisma from './config/database';
import logger from './middlewares/logger.middleware';
import { CronService, StatsCronService } from './modules/cron/cron.service';
import { ExchangeRateService } from './modules/shared/exchange-rate.service';
import { YouTubeScraperService } from './modules/shared/youtube-scraper.service';

// Get local IP address
const getLocalIP = (): string => {
  const interfaces = networkInterfaces();
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
    await prisma.$connect();
    logger.info('Database connected successfully');

    const localIP = getLocalIP();
    app.listen(config.port, '0.0.0.0', () => {
      logger.info(`Server running on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`API: http://localhost:${config.port}/api`);
      logger.info(`Network API: http://${localIP}:${config.port}/api`);
      logger.info(`Health: http://localhost:${config.port}/api/health`);

      // Start cron scheduler for all admins
      CronService.startAllSchedulers().catch(err => {
        logger.warn('Failed to start cron scheduler:', err.message);
      });

      // Start stats cron scheduler
      StatsCronService.startScheduler().catch(err => {
        logger.warn('Failed to start stats cron scheduler:', err.message);
      });

      // Start exchange rate auto-refresher (every 10 minutes)
      ExchangeRateService.startRateRefresher();

      // YouTube sessions managed by GemLogin - no persistent sessions needed

    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
