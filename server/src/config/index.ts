import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),

  database: {
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // SocialBlade: now scraped via Puppeteer, no API credentials needed

  cors: {
    origin: process.env.NODE_ENV === 'development' 
      ? [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/, // Allow 192.168.x.x:5173
          /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/, // Allow 10.x.x.x:5173
          /^http:\/\/172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}:5173$/, // Allow 172.16-31.x.x:5173
        ]
      : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  },

  defaultAdmin: {
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@koc.vn',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.SMTP_FROM_NAME || 'EBE CMS',
    fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@ebe.vn',
  },

  appUrl: process.env.APP_URL || 'http://localhost:5173',
} as const;
