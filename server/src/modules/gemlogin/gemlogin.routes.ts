import { Router } from 'express';
import { GemLoginController } from './gemlogin.controller';
import { SettingsController } from '../settings/settings.controller';
import { authMiddleware, canModify } from '../../middlewares';

const router = Router();

router.use(authMiddleware);

// ── Info ──────────────────────────────────────────────────────────────────────
router.get('/browser-versions', GemLoginController.getBrowserVersions);
router.get('/groups', GemLoginController.getGroups);

// ── Profiles ──────────────────────────────────────────────────────────────────
router.get('/profiles', GemLoginController.getProfiles);
router.get('/profiles/:id', GemLoginController.getProfile);
router.post('/profiles', canModify, GemLoginController.createProfile);
router.put('/profiles/:id', canModify, GemLoginController.updateProfile);
router.delete('/profiles/:id', canModify, GemLoginController.deleteProfile);
router.post('/profiles/fingerprint', canModify, GemLoginController.changeFingerprint);

// ── Browser control (tích hợp với YouTubeScraperService) ─────────────────────
router.post('/start', canModify, GemLoginController.startProfile);
router.post('/close', canModify, GemLoginController.closeProfile);
router.get('/status', GemLoginController.getStatus);
router.get('/google-status', SettingsController.getGoogleStatus);
router.post('/google-status/check', canModify, SettingsController.checkGoogleStatus);

// ── Cào doanh thu qua GemLogin ────────────────────────────────────────────────
router.post('/scrape-revenue', canModify, GemLoginController.scrapeRevenue);
router.post('/run-cron', canModify, GemLoginController.runCron);

export default router;
