import { Router } from 'express';
import { GemLoginController } from '../controllers/gemlogin.controller';
import { authMiddleware } from '../middlewares';

const router = Router();

router.use(authMiddleware);

// ── Info ──────────────────────────────────────────────────────────────────────
router.get('/browser-versions', GemLoginController.getBrowserVersions);
router.get('/groups', GemLoginController.getGroups);

// ── Profiles ──────────────────────────────────────────────────────────────────
router.get('/profiles', GemLoginController.getProfiles);
router.get('/profiles/:id', GemLoginController.getProfile);
router.post('/profiles', GemLoginController.createProfile);
router.put('/profiles/:id', GemLoginController.updateProfile);
router.delete('/profiles/:id', GemLoginController.deleteProfile);
router.post('/profiles/fingerprint', GemLoginController.changeFingerprint);

// ── Browser control (tích hợp với YouTubeScraperService) ─────────────────────
router.post('/start', GemLoginController.startProfile);
router.post('/close', GemLoginController.closeProfile);
router.get('/status', GemLoginController.getStatus);

// ── Cào doanh thu qua GemLogin ────────────────────────────────────────────────
router.post('/scrape-revenue', GemLoginController.scrapeRevenue);
router.post('/run-cron', GemLoginController.runCron);

export default router;
