import { Router } from 'express';
import auditRoutes from '../modules/audit/audit.routes';
import authRoutes from '../modules/auth/auth.routes';
import cronRoutes from '../modules/cron/cron.routes';
import cycleRoutes from '../modules/cycle/cycle.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import emailRoutes from '../modules/email/email.routes';
import gemloginRoutes from '../modules/gemlogin/gemlogin.routes';
import kocPortalRoutes from '../modules/koc-portal/koc-portal.routes';
import kocRoutes from '../modules/koc/koc.routes';
import permissionRoutes from '../modules/permissions/permission.routes';
import progressRoutes from '../modules/progress/progress.routes';
import revenueRoutes from '../modules/revenue/revenue.routes';
import settingsRoutes from '../modules/settings/settings.routes';
import statsRoutes from '../modules/stats/stats.routes';
import uploadRoutes from '../modules/upload/upload.routes';
import ytScraperRoutes from '../modules/yt-scraper/youtube-scraper.routes';

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
router.use('/cron', cronRoutes);
router.use('/email', emailRoutes);
router.use('/progress', progressRoutes);
router.use('/gemlogin', gemloginRoutes);
router.use('/permissions', permissionRoutes);
router.use('/settings', settingsRoutes);
router.use('/upload', uploadRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), routes: 'settings-loaded', dev: 'nodemon-active' });
});

export default router;
