import { Router } from 'express';
import * as youtubeApiController from '../controllers/youtube-api.controller';
import { authMiddleware, canModify } from '../middlewares';

const router = Router();

// OAuth flow
router.post('/auth/:channelId', authMiddleware, canModify, youtubeApiController.getAuthUrl);
router.get('/oauth2callback', youtubeApiController.handleOAuthCallback);
router.get('/status/:channelId', authMiddleware, youtubeApiController.checkAuthStatus);
router.delete('/auth/:channelId', authMiddleware, canModify, youtubeApiController.revokeAccess);

// Analytics
router.post('/analytics/:channelId', authMiddleware, canModify, youtubeApiController.fetchAnalytics);

export default router;
