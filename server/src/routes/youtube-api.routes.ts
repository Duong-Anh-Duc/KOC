import { Router } from 'express';
import * as youtubeApiController from '../controllers/youtube-api.controller';
import { authMiddleware } from '../middlewares';

const router = Router();

// OAuth flow
router.post('/auth/:channelId', authMiddleware, youtubeApiController.getAuthUrl);
router.get('/oauth2callback', youtubeApiController.handleOAuthCallback);
router.get('/status/:channelId', authMiddleware, youtubeApiController.checkAuthStatus);
router.delete('/auth/:channelId', authMiddleware, youtubeApiController.revokeAccess);

// Analytics
router.post('/analytics/:channelId', authMiddleware, youtubeApiController.fetchAnalytics);

export default router;
