import { Router } from 'express';
import auditRoutes from './audit.routes';
import authRoutes from './auth.routes';
import cronRoutes from './cron.routes';
import cycleRoutes from './cycle.routes';
import dashboardRoutes from './dashboard.routes';
import emailRoutes from './email.routes';
import kocPortalRoutes from './koc-portal.routes';
import kocRoutes from './koc.routes';
import progressRoutes from './progress.routes';
import revenueRoutes from './revenue.routes';
import statsRoutes from './stats.routes';
import youtubeApiRoutes from './youtube-api.routes';
import ytScraperRoutes from './youtube-scraper.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/kocs', kocRoutes);
router.use('/koc-portal', kocPortalRoutes);
router.use('/revenue', revenueRoutes);
router.use('/cycles', cycleRoutes);
router.use('/stats', statsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/yt-scraper', ytScraperRoutes);
router.use('/youtube', youtubeApiRoutes);
router.use('/cron', cronRoutes);
router.use('/email', emailRoutes);
router.use('/progress', progressRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
