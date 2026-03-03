import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config';
import { i18nMiddleware } from './i18n';
import { errorHandler, notFoundHandler, requestLogger } from './middlewares';
import routes from './routes';

const app = express();

// Trust nginx reverse proxy — reads real client IP from X-Forwarded-For
app.set('trust proxy', 1);

// ============================================================
// SECURITY MIDDLEWARES
// ============================================================
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language'],
}));

// Rate limiting (per real client IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // limit each IP to 2000 requests per 15 minutes
  message: { success: false, message: 'general.tooManyRequests' },
});
app.use('/api/', limiter);

// ============================================================
// BODY PARSING
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ============================================================
// INTERNATIONALIZATION
// ============================================================
app.use(i18nMiddleware);

// ============================================================
// LOGGING
// ============================================================
app.use(requestLogger);

// ============================================================
// ROUTES
// ============================================================
app.use('/api', routes);

// ============================================================
// ERROR HANDLING
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
