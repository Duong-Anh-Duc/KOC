import { Response } from 'express';
import { UploadService } from './upload.service';
import { AuthenticatedRequest } from '../../types';

export class UploadController {
  /**
   * POST /api/upload/koc/:kocId/avatar
   */
  static async uploadKocAvatar(req: AuthenticatedRequest, res: Response) {
    try {
      const { kocId } = req.params;
      const file = (req as any).file;

      if (!file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }

      const url = await UploadService.uploadKocAvatar(kocId as string, file.buffer, file.mimetype);

      res.json({
        success: true,
        message: req.t?.('upload.success') || 'Upload thành công',
        data: { avatar_url: url },
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/upload/user/avatar
   */
  static async uploadUserAvatar(req: AuthenticatedRequest, res: Response) {
    try {
      const file = (req as any).file;

      if (!file || !req.user) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }

      const url = await UploadService.uploadUserAvatar(req.user.userId, file.buffer, file.mimetype);

      res.json({
        success: true,
        message: req.t?.('upload.success') || 'Upload thành công',
        data: { avatar_url: url },
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
