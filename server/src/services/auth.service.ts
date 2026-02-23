import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../config/database';
import { ApiError } from '../middlewares';
import { JwtPayload } from '../types';

export class AuthService {
  /**
   * Login with email and password
   */
  static async login(email: string, password: string): Promise<{ token: string; user: Omit<JwtPayload, 'iat' | 'exp'> & { full_name: string } }> {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.is_active) {
      throw new ApiError(401, 'auth.loginFailed');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new ApiError(401, 'auth.loginFailed');
    }

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(user.koc_id ? { kocId: user.koc_id } : {}),
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    return {
      token,
      user: {
        userId: user.id,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        ...(user.koc_id ? { kocId: user.koc_id } : {}),
      },
    };
  }

  /**
   * Register a new user (Admin only operation)
   */
  static async register(
    email: string,
    password: string,
    fullName: string,
    role: UserRole = UserRole.ACCOUNTANT
  ) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(409, 'auth.emailExists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        full_name: fullName,
        role,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        created_at: true,
      },
    });

    return user;
  }

  /**
   * Create a user account for a KOC (Admin only)
   */
  static async createKocAccount(kocId: string, email: string, password: string) {
    // Verify KOC exists
    const koc = await prisma.kOC.findUnique({ where: { id: kocId } });
    if (!koc) {
      throw new ApiError(404, 'koc.notFound');
    }

    // Check if KOC already has an account
    const existingLink = await prisma.user.findFirst({ where: { koc_id: kocId } });
    if (existingLink) {
      throw new ApiError(409, 'auth.kocAccountExists');
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(409, 'auth.emailExists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        full_name: koc.full_name,
        role: UserRole.KOC,
        koc_id: kocId,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        koc_id: true,
        created_at: true,
      },
    });

    return user;
  }

  /**
   * Get current user info
   */
  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        is_active: true,
        koc_id: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new ApiError(404, 'auth.userNotFound');
    }

    return user;
  }
}
