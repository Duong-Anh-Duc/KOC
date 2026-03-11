"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeAccess = exports.fetchAnalytics = exports.checkAuthStatus = exports.handleOAuthCallback = exports.getAuthUrl = void 0;
const logger_middleware_1 = __importDefault(require("../middlewares/logger.middleware"));
const youtube_api_service_1 = require("../services/youtube-api.service");
/**
 * Get OAuth authorization URL
 * POST /api/youtube/auth/:channelId
 */
const getAuthUrl = async (req, res) => {
    try {
        const t = req.t;
        const channelId = req.params.channelId;
        const authUrl = youtube_api_service_1.youtubeAPIService.getAuthUrl(channelId);
        res.json({
            success: true,
            authUrl,
            message: t ? t('youtubeAPI.openAuthUrl') : 'Open this URL to authorize YouTube access'
        });
    }
    catch (error) {
        logger_middleware_1.default.error('Failed to get auth URL:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.getAuthUrl = getAuthUrl;
/**
 * Handle OAuth callback
 * GET /api/youtube/oauth2callback?code=xxx&state=channelId
 */
const handleOAuthCallback = async (req, res) => {
    try {
        const t = req.t;
        const { code, state: channelId } = req.query;
        if (!code || !channelId) {
            return res.status(400).send(t ? t('youtubeAPI.missingCodeOrChannel') : 'Missing code or channel ID');
        }
        await youtube_api_service_1.youtubeAPIService.handleOAuthCallback(code, channelId);
        res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>✅ ${t ? t('youtubeAPI.authSuccess') : 'Authorization Successful!'}</h1>
          <p>${t ? t('youtubeAPI.channelAuthorized', { channelId }) : `Channel <strong>${channelId}</strong> has been authorized`}</p>
          <p>${t ? t('youtubeAPI.closeWindow') : 'You can close this window and return to the app'}</p>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
    }
    catch (error) {
        const t = req.t;
        logger_middleware_1.default.error('OAuth callback failed:', error);
        res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>❌ ${t ? t('youtubeAPI.authFailed') : 'Authorization Failed'}</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `);
    }
};
exports.handleOAuthCallback = handleOAuthCallback;
/**
 * Check if channel has valid tokens
 * GET /api/youtube/status/:channelId
 */
const checkAuthStatus = async (req, res) => {
    try {
        const channelId = req.params.channelId;
        const hasTokens = youtube_api_service_1.youtubeAPIService.hasValidTokens(channelId);
        res.json({
            success: true,
            authorized: hasTokens
        });
    }
    catch (error) {
        logger_middleware_1.default.error('Failed to check auth status:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.checkAuthStatus = checkAuthStatus;
/**
 * Fetch analytics for a channel
 * POST /api/youtube/analytics/:channelId
 * Body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
const fetchAnalytics = async (req, res) => {
    try {
        const t = req.t;
        const channelId = req.params.channelId;
        const { startDate, endDate } = req.body;
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: t ? t('youtubeAPI.missingDateRange') : 'Missing startDate or endDate'
            });
        }
        const data = await youtube_api_service_1.youtubeAPIService.fetchAnalytics(channelId, startDate, endDate);
        res.json({
            success: true,
            data
        });
    }
    catch (error) {
        logger_middleware_1.default.error(`Failed to fetch analytics for ${req.params.channelId}:`, error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.fetchAnalytics = fetchAnalytics;
/**
 * Revoke access for a channel
 * DELETE /api/youtube/auth/:channelId
 */
const revokeAccess = async (req, res) => {
    try {
        const t = req.t;
        const channelId = req.params.channelId;
        await youtube_api_service_1.youtubeAPIService.revokeAccess(channelId);
        res.json({
            success: true,
            message: t ? t('youtubeAPI.accessRevoked') : 'Access revoked successfully'
        });
    }
    catch (error) {
        logger_middleware_1.default.error('Failed to revoke access:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.revokeAccess = revokeAccess;
//# sourceMappingURL=youtube-api.controller.js.map