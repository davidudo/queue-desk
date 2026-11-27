import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { hasPermission, type Permission, type RoleName } from '@queuedesk/shared';
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { hashToken } from '../utils/password.js';

interface JwtPayload {
  sub: string;
  email: string;
  role: RoleName;
  jti?: string;
}

export const AUTH_COOKIE_NAME = 'qd_token';

export function extractToken(req: Request): string | null {
  const authHeader = req.header('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  return null;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      return next(new UnauthorizedError('Authentication token is missing'));
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      return next(new UnauthorizedError('Invalid or expired authentication token'));
    }

    const tokenHash = hashToken(token);
    const { rows } = await pool.query<{
      user_id: string;
      email: string;
      full_name: string;
      role_name: RoleName;
      is_active: boolean;
      agent_id: string | null;
    }>(
      `SELECT
         u.id AS user_id,
         u.email,
         u.full_name,
         r.name AS role_name,
         u.is_active,
         a.id AS agent_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN agents a ON a.user_id = u.id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
         AND u.id = $2`,
      [tokenHash, decoded.sub],
    );

    const row = rows[0];
    if (!row || !row.is_active) {
      return next(new UnauthorizedError('Session is expired, revoked, or user is inactive'));
    }

    req.user = {
      id: row.user_id,
      email: row.email,
      fullName: row.full_name,
      role: row.role_name,
      agentId: row.agent_id,
    };
    req.authToken = token;

    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!hasPermission(req.user.role, permission)) {
      return next(new ForbiddenError(`Missing required permission: ${permission}`));
    }
    next();
  };
}

export function requireRole(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Your role is not authorized for this resource'));
    }
    next();
  };
}
