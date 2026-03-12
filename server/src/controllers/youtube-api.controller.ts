import { Request, Response } from 'express';
import logger from '../middlewares/logger.middleware';
import { youtubeAPIService } from '../services/youtube-api.service';

/**
 * Get OAuth authorization URL
 * POST /api/youtube/auth/:channelId
 */
export const getAuthUrl = async (req: Request, res: Response) => {
  try {
    const t = (req as any).t;
    const channelId = req.params.channelId as string;
    const authUrl = youtubeAPIService.getAuthUrl(channelId);
    
    res.json({ 
      success: true,
      authUrl,
      message: t ? t('youtubeAPI.openAuthUrl') : 'Open this URL to authorize YouTube access'
    });
  } catch (error: any) {
    logger.error('Failed to get auth URL:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * Handle OAuth callback
 * GET /api/youtube/oauth2callback?code=xxx&state=channelId
 */
export const handleOAuthCallback = async (req: Request, res: Response) => {
  try {
    const t = (req as any).t;
    const { code, state: channelId } = req.query;
    
    if (!code || !channelId) {
      return res.status(400).send(t ? t('youtubeAPI.missingCodeOrChannel') : 'Missing code or channel ID');
    }

    await youtubeAPIService.handleOAuthCallback(code as string, channelId as string);
    
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>${t ? t('youtubeAPI.authSuccess') : 'Authorization Successful!'}</h1>
          <p>${t ? t('youtubeAPI.channelAuthorized', { channelId }) : `Channel <strong>${channelId}</strong> has been authorized`}</p>
          <p>${t ? t('youtubeAPI.closeWindow') : 'You can close this window and return to the app'}</p>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    const t = (req as any).t;
    logger.error('OAuth callback failed:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>${t ? t('youtubeAPI.authFailed') : 'Authorization Failed'}</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `);
  }
};

/**
 * Check if channel has valid tokens
 * GET /api/youtube/status/:channelId
 */
export const checkAuthStatus = async (req: Request, res: Response) => {
  try {
    const channelId = req.params.channelId as string;
    const hasTokens = youtubeAPIService.hasValidTokens(channelId);
    
    res.json({ 
      success: true,
      authorized: hasTokens 
    });
  } catch (error: any) {
    logger.error('Failed to check auth status:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * Fetch analytics for a channel
 * POST /api/youtube/analytics/:channelId
 * Body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
export const fetchAnalytics = async (req: Request, res: Response) => {
  try {
    const t = (req as any).t;
    const channelId = req.params.channelId as string;
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: t ? t('youtubeAPI.missingDateRange') : 'Missing startDate or endDate'
      });
    }

    const data = await youtubeAPIService.fetchAnalytics(channelId, startDate, endDate);
    
    res.json({ 
      success: true,
      data 
    });
  } catch (error: any) {
    logger.error(`Failed to fetch analytics for ${req.params.channelId}:`, error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

/**
 * Revoke access for a channel
 * DELETE /api/youtube/auth/:channelId
 */
export const revokeAccess = async (req: Request, res: Response) => {
  try {
    const t = (req as any).t;
    const channelId = req.params.channelId as string;
    await youtubeAPIService.revokeAccess(channelId);
    
    res.json({ 
      success: true,
      message: t ? t('youtubeAPI.accessRevoked') : 'Access revoked successfully'
    });
  } catch (error: any) {
    logger.error('Failed to revoke access:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};
