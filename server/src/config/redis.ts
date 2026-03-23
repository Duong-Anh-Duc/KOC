import Redis from 'ioredis';
import logger from '../middlewares/logger.middleware';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) return null;
    return Math.min(times * 200, 1000);
  },
});

redis.on('connect', () => logger.info('[Redis] Connected'));
redis.on('error', (err) => logger.error(`[Redis] Error: ${err.message}`));

export default redis;

// OTP TTL in seconds
export const OTP_TTL = 300; // 5 minutes
export const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export const OtpStore = {
  /** Save OTP for email, overwrite any existing one */
  async set(email: string, otp: string): Promise<void> {
    await redis.setex(`otp:reset:${email}`, OTP_TTL, otp);
  },

  /** Get OTP for email (null if not found/expired) */
  async get(email: string): Promise<string | null> {
    return redis.get(`otp:reset:${email}`);
  },

  /** Get remaining TTL in seconds */
  async ttl(email: string): Promise<number> {
    return redis.ttl(`otp:reset:${email}`);
  },

  /** Delete OTP after use */
  async del(email: string): Promise<void> {
    await redis.del(`otp:reset:${email}`);
  },
};

export const RefreshTokenStore = {
  /** Store refresh token → userId mapping */
  async set(token: string, userId: string): Promise<void> {
    await redis.setex(`rt:${token}`, REFRESH_TOKEN_TTL, userId);
  },

  /** Get userId from refresh token (null = expired/invalid) */
  async get(token: string): Promise<string | null> {
    return redis.get(`rt:${token}`);
  },

  /** Delete (revoke) a refresh token */
  async del(token: string): Promise<void> {
    await redis.del(`rt:${token}`);
  },

  /** Revoke all refresh tokens for a user (force logout all devices) */
  async revokeAll(userId: string): Promise<void> {
    // Scan all rt: keys and delete those belonging to this user
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'rt:*', 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        const values = await redis.mget(...keys);
        const toDelete = keys.filter((_, i) => values[i] === userId);
        if (toDelete.length > 0) await redis.del(...toDelete);
      }
    } while (cursor !== '0');
  },
};
