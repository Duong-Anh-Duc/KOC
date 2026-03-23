import cloudinary from '../../config/cloudinary';
import prisma from '../../config/database';

export class UploadService {
  /**
   * Upload avatar for a KOC
   */
  static async uploadKocAvatar(kocId: string, fileBuffer: Buffer, mimetype: string): Promise<string> {
    const koc = await prisma.kOC.findUnique({ where: { id: kocId } });
    if (!koc) throw new Error('KOC not found');

    // Delete old avatar if exists
    if (koc.avatar_url) {
      const publicId = this.extractPublicId(koc.avatar_url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId).catch(() => {});
      }
    }

    const url = await this.uploadToCloudinary(fileBuffer, `koc-avatars/${kocId}`);

    await prisma.kOC.update({
      where: { id: kocId },
      data: { avatar_url: url },
    });

    return url;
  }

  /**
   * Upload avatar for a User
   */
  static async uploadUserAvatar(userId: string, fileBuffer: Buffer, mimetype: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    if (user.avatar_url) {
      const publicId = this.extractPublicId(user.avatar_url);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId).catch(() => {});
      }
    }

    const url = await this.uploadToCloudinary(fileBuffer, `user-avatars/${userId}`);

    await prisma.user.update({
      where: { id: userId },
      data: { avatar_url: url },
    });

    return url;
  }

  /**
   * Upload buffer to Cloudinary
   */
  private static uploadToCloudinary(buffer: Buffer, publicId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            public_id: publicId,
            folder: 'ebe-cms',
            overwrite: true,
            transformation: [
              { width: 300, height: 300, crop: 'fill', gravity: 'face' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result!.secure_url);
          }
        )
        .end(buffer);
    });
  }

  /**
   * Extract Cloudinary public_id from URL
   */
  private static extractPublicId(url: string): string | null {
    try {
      const parts = url.split('/upload/');
      if (parts.length < 2) return null;
      // Remove version and extension: v1234567890/ebe-cms/koc-avatars/uuid.jpg → ebe-cms/koc-avatars/uuid
      const path = parts[1].replace(/^v\d+\//, '').replace(/\.\w+$/, '');
      return path;
    } catch {
      return null;
    }
  }
}
