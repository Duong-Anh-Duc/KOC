import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticatedRequest, JwtPayload } from '../types';
/**
 * Middleware to verify JWT token and attach user to request
 */

export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: req.t?.('auth.tokenRequired') || 'Authentication token is required',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: req.t?.('auth.tokenExpired') || 'Token has expired',
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: req.t?.('auth.invalidToken') || 'Invalid authentication token',
    });
  }
};

/**
 * Middleware to require ADMIN role
 */
export const adminOnly = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: req.t?.('auth.authRequired') || 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      message: req.t?.('auth.adminOnly') || 'Admin access required',
    });
    return;
  }

  next();
};

/**
 * Middleware to block KOC role (allow ADMIN & ACCOUNTANT only)
 */
export const adminOrAccountant = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: req.t?.('auth.authRequired') || 'Authentication required',
    });
    return;
  }

  if (req.user.role === 'KOC') {
    res.status(403).json({
      success: false,
      message: req.t?.('auth.staffOnly') || 'Staff access required',
    });
    return;
  }

  next();
};
