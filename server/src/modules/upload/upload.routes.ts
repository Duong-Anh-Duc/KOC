import { Router } from 'express';
import multer from 'multer';
import { UploadController } from './upload.controller';
import { authMiddleware, adminOnly } from '../../middlewares';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Upload KOC avatar (Admin only)
router.post('/koc/:kocId/avatar', authMiddleware, adminOnly, upload.single('avatar'), UploadController.uploadKocAvatar);

// Upload User avatar (own profile)
router.post('/user/avatar', authMiddleware, upload.single('avatar'), UploadController.uploadUserAvatar);

export default router;
