import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { LoginInput, LoginResponse } from '@queuedesk/shared';
import { env } from '../config/env.js';
import { adminRepository } from '../repositories/admin.repository.js';
import { authRepository } from '../repositories/auth.repository.js';
import { UnauthorizedError } from '../utils/errors.js';
import { hashToken, verifyPassword } from '../utils/password.js';

function parseDurationMs(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());
  if (!match) return 8 * 3600_000;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3600_000,
    d: 86400_000,
  };
  return value * (multipliers[unit!] ?? 3600_000);
}

export const authService = {
  async login(
    input: LoginInput,
    meta: { ipAddress: string | null; userAgent: string | null },
  ): Promise<LoginResponse> {
    const userRow = await authRepository.findUserByEmail(input.email);
    if (!userRow || !userRow.is_active) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await verifyPassword(input.password, userRow.password_hash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const jti = crypto.randomUUID();
    const token = jwt.sign(
      {
        sub: userRow.id,
        email: userRow.email,
        role: userRow.role_name,
        jti,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const expiresAt = new Date(Date.now() + parseDurationMs(env.JWT_EXPIRES_IN));
    await authRepository.createSession({
      userId: userRow.id,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await adminRepository.insertAuditLog({
      actorId: userRow.id,
      actorEmail: userRow.email,
      action: 'auth.login',
      entityType: 'session',
      entityId: jti,
      ipAddress: meta.ipAddress,
    });

    return {
      user: authRepository.toAuthUser(userRow),
      token,
      expiresAt: expiresAt.toISOString(),
    };
  },

  async logout(token: string, actor: { id: string; email: string }, ipAddress: string | null) {
    await authRepository.revokeSessionByTokenHash(hashToken(token));
    await adminRepository.insertAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'auth.logout',
      entityType: 'session',
      ipAddress,
    });
  },
};
