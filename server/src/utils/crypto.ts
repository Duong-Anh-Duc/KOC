import crypto from 'crypto';

/**
 * AES-256-GCM helpers cho việc encrypt/decrypt credentials lưu DB.
 *
 * Key: lấy từ env SETTING_ENCRYPTION_KEY (64 ký tự hex = 32 bytes).
 * Format output: base64(iv | authTag | ciphertext)
 *
 * Tạo key mới (chạy 1 lần để gen key cho .env):
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.SETTING_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'SETTING_ENCRYPTION_KEY chưa cấu hình hoặc không phải 64 ký tự hex (32 bytes). ' +
      'Tạo bằng: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

export function encryptString(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptString(blob: string): string {
  const key = getKey();
  const data = Buffer.from(blob, 'base64');
  const iv = data.subarray(0, IV_LEN);
  const authTag = data.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const ciphertext = data.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

/** Safe wrapper — trả null nếu blob không hợp lệ. */
export function tryDecryptString(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    return decryptString(blob);
  } catch {
    return null;
  }
}
