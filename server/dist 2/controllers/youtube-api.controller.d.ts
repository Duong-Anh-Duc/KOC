import { Request, Response } from 'express';
/**
 * Get OAuth authorization URL
 * POST /api/youtube/auth/:channelId
 */
export declare const getAuthUrl: (req: Request, res: Response) => Promise<void>;
/**
 * Handle OAuth callback
 * GET /api/youtube/oauth2callback?code=xxx&state=channelId
 */
export declare const handleOAuthCallback: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Check if channel has valid tokens
 * GET /api/youtube/status/:channelId
 */
export declare const checkAuthStatus: (req: Request, res: Response) => Promise<void>;
/**
 * Fetch analytics for a channel
 * POST /api/youtube/analytics/:channelId
 * Body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
export declare const fetchAnalytics: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Revoke access for a channel
 * DELETE /api/youtube/auth/:channelId
 */
export declare const revokeAccess: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=youtube-api.controller.d.ts.map