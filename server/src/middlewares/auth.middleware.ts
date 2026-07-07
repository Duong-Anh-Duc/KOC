import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../config/database';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { PermissionService } from '../modules/permissions/permission.service';
import type { KocPermission } from '../modules/permissions/permission.service';
/**
 * Middleware to verify JWT token and attach user to request
 */

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { is_active: true, is_ban: true },
    });

    if (!user || !user.is_active) {
      res.status(401).json({
        success: false,
        message: req.t?.('auth.unauthorized') || 'Unauthorized',
      });
      return;
    }

    if (user.is_ban) {
      res.status(403).json({
        success: false,
        message: req.t?.('auth.accountSuspended') || 'This account has been temporarily suspended',
        code: 'ACCOUNT_SUSPENDED',
      });
      return;
    }

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
 * Middleware to block KOC role (allow ADMIN & ACCOUNTANT & VIEWER only)
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

/**
 * Middleware to block VIEWER and KOC roles from write operations
 * Only ADMIN and ACCOUNTANT can modify data
 */
export const canModify = (
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

  if (req.user.role === 'VIEWER' || req.user.role === 'KOC') {
    res.status(403).json({
      success: false,
      message: req.t?.('auth.viewerReadOnly') || 'View-only access. You cannot modify data.',
    });
    return;
  }

  next();
};

export const requireAnyPermission = (...permissions: KocPermission[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: req.t?.('auth.authRequired') || 'Authentication required',
        });
        return;
      }

      if (req.user.role === 'ADMIN') {
        next();
        return;
      }

      if (req.user.role !== 'ACCOUNTANT') {
        res.status(403).json({
          success: false,
          message: req.t?.('auth.viewerReadOnly') || 'View-only access. You cannot modify data.',
        });
        return;
      }

      const access = await PermissionService.getManagerAccessDetail(req.user.userId);
      const hasPermission = permissions.some((permission) => access.aggregated.includes(permission));

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          message: req.t?.('auth.permissionRequired') || 'Bạn chưa được cấp quyền thực hiện thao tác này.',
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
