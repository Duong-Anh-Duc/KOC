import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../types';

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

export class ApiError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const t = (req as any).t;

  if (err instanceof ApiError) {
    const message = t ? t(err.message, { defaultValue: err.message }) : err.message;
    res.status(err.statusCode).json({
      success: false,
      message,
    });
    return;
  }

  // Session expired (GemLogin profile may need restart)
  if (err.message === 'NOT_LOGGED_IN') {
    res.status(401).json({
      success: false,
      message: 'Phiên YouTube Studio đã hết hạn. Vui lòng khởi động lại GemLogin profile.',
      code: 'NOT_LOGGED_IN',
    });
    return;
  }

  console.error('Unhandled Error:', err);

  const fallback = t ? t('general.serverError') : 'Internal server error';
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : fallback,
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const t = (req as any).t;
  const message = t
    ? t('general.notFound', { method: req.method, url: req.originalUrl })
    : `Route ${req.method} ${req.originalUrl} not found`;
  res.status(404).json({
    success: false,
    message,
  });
};
