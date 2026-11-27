import type { AuthUser, RoleName } from '@queuedesk/shared';
import { pool } from '../config/database.js';

export interface UserWithPasswordRow {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role_name: RoleName;
  is_active: boolean;
  agent_id: string | null;
}

export const authRepository = {
  async findUserByEmail(email: string): Promise<UserWithPasswordRow | null> {
    const { rows } = await pool.query<UserWithPasswordRow>(
      `SELECT
         u.id,
         u.email,
         u.full_name,
         u.password_hash,
         r.name AS role_name,
         u.is_active,
         a.id AS agent_id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN agents a ON a.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email],
    );
    return rows[0] ?? null;
  },

  async createSession(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [params.userId, params.tokenHash, params.expiresAt, params.ipAddress, params.userAgent],
    );
  },

  async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    await pool.query(
      `UPDATE sessions SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  },

  toAuthUser(row: UserWithPasswordRow): AuthUser {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role_name,
      agentId: row.agent_id,
    };
  },
};
