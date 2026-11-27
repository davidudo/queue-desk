import type {
  AgentDTO,
  AuditLogDTO,
  AuditLogQuery,
  CreateQueueInput,
  CreateTagInput,
  CreateUserInput,
  QueueDTO,
  RoleName,
  TagDTO,
  UpdateAgentInput,
  UpdateQueueInput,
  UpdateUserRoleInput,
  UserSummaryDTO,
} from '@queuedesk/shared';
import { pool, withTransaction } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';

export const adminRepository = {
  async listQueues(): Promise<QueueDTO[]> {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      slug: string;
      description: string;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM queues ORDER BY name ASC');

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isActive: r.is_active,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  },

  async createQueue(input: CreateQueueInput): Promise<QueueDTO> {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      slug: string;
      description: string;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO queues (name, slug, description, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.name, input.slug, input.description, input.isActive],
    );
    const r = rows[0]!;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isActive: r.is_active,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  },

  async updateQueue(id: string, input: UpdateQueueInput): Promise<QueueDTO> {
    const { rows: existing } = await pool.query<{
      name: string;
      description: string;
      is_active: boolean;
    }>('SELECT name, description, is_active FROM queues WHERE id = $1', [id]);
    if (!existing[0]) throw new NotFoundError('Queue');

    const { rows } = await pool.query<{
      id: string;
      name: string;
      slug: string;
      description: string;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE queues
       SET name = $1, description = $2, is_active = $3
       WHERE id = $4
       RETURNING *`,
      [
        input.name ?? existing[0].name,
        input.description ?? existing[0].description,
        input.isActive ?? existing[0].is_active,
        id,
      ],
    );
    const r = rows[0]!;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isActive: r.is_active,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  },

  async listTags(): Promise<TagDTO[]> {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      color: string;
      created_at: Date;
    }>('SELECT id, name, color, created_at FROM tags ORDER BY name ASC');

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      createdAt: r.created_at.toISOString(),
    }));
  },

  async createTag(input: CreateTagInput): Promise<TagDTO> {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      color: string;
      created_at: Date;
    }>('INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING id, name, color, created_at', [
      input.name,
      input.color,
    ]);
    const r = rows[0]!;
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      createdAt: r.created_at.toISOString(),
    };
  },

  async deleteTag(id: string): Promise<void> {
    const res = await pool.query('DELETE FROM tags WHERE id = $1', [id]);
    if ((res.rowCount ?? 0) === 0) {
      throw new NotFoundError('Tag');
    }
  },

  async listAgents(): Promise<AgentDTO[]> {
    const { rows } = await pool.query<{
      id: string;
      user_id: string;
      full_name: string;
      email: string;
      role_name: RoleName;
      department: string;
      max_capacity: number;
      is_available: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT
         a.id,
         a.user_id,
         u.full_name,
         u.email,
         r.name AS role_name,
         a.department,
         a.max_capacity,
         a.is_available,
         a.created_at,
         a.updated_at
       FROM agents a
       JOIN users u ON u.id = a.user_id
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.full_name ASC`,
    );

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      fullName: r.full_name,
      email: r.email,
      role: r.role_name,
      department: r.department,
      maxCapacity: r.max_capacity,
      isAvailable: r.is_available,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  },

  async updateAgent(id: string, input: UpdateAgentInput): Promise<AgentDTO> {
    const { rows: existing } = await pool.query<{
      department: string;
      max_capacity: number;
      is_available: boolean;
    }>('SELECT department, max_capacity, is_available FROM agents WHERE id = $1', [id]);
    if (!existing[0]) throw new NotFoundError('Agent');

    await pool.query(
      `UPDATE agents
       SET department = $1, max_capacity = $2, is_available = $3
       WHERE id = $4`,
      [
        input.department ?? existing[0].department,
        input.maxCapacity ?? existing[0].max_capacity,
        input.isAvailable ?? existing[0].is_available,
        id,
      ],
    );

    const agents = await this.listAgents();
    const updated = agents.find((a) => a.id === id);
    if (!updated) throw new NotFoundError('Agent');
    return updated;
  },

  async listUsers(): Promise<UserSummaryDTO[]> {
    const { rows } = await pool.query<{
      id: string;
      email: string;
      full_name: string;
      role_name: RoleName;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT u.id, u.email, u.full_name, r.name AS role_name, u.is_active, u.created_at, u.updated_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.full_name ASC`,
    );

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      role: r.role_name,
      isActive: r.is_active,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  },

  async createUser(input: CreateUserInput): Promise<UserSummaryDTO> {
    const passwordHash = await hashPassword(input.password);
    const userId = await withTransaction(async (client) => {
      const { rows: roleRows } = await client.query<{ id: string }>(
        'SELECT id FROM roles WHERE name = $1',
        [input.role],
      );
      if (!roleRows[0]) throw new NotFoundError('Role');

      const { rows: uRows } = await client.query<{ id: string }>(
        `INSERT INTO users (email, full_name, password_hash, role_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [input.email, input.fullName, passwordHash, roleRows[0].id],
      );
      const id = uRows[0]!.id;

      await client.query(`INSERT INTO agents (user_id, department) VALUES ($1, $2)`, [
        id,
        input.department ?? 'General Support',
      ]);
      return id;
    });

    const users = await this.listUsers();
    const created = users.find((u) => u.id === userId);
    if (!created) throw new NotFoundError('User');
    return created;
  },

  async updateUserRole(userId: string, input: UpdateUserRoleInput): Promise<UserSummaryDTO> {
    await withTransaction(async (client) => {
      const { rows: roleRows } = await client.query<{ id: string }>(
        'SELECT id FROM roles WHERE name = $1',
        [input.role],
      );
      if (!roleRows[0]) throw new NotFoundError('Role');

      const { rows: userRows } = await client.query<{ is_active: boolean }>(
        'SELECT is_active FROM users WHERE id = $1',
        [userId],
      );
      if (!userRows[0]) throw new NotFoundError('User');

      await client.query(`UPDATE users SET role_id = $1, is_active = $2 WHERE id = $3`, [
        roleRows[0].id,
        input.isActive ?? userRows[0].is_active,
        userId,
      ]);
    });

    const users = await this.listUsers();
    const updated = users.find((u) => u.id === userId);
    if (!updated) throw new NotFoundError('User');
    return updated;
  },

  async insertAuditLog(params: {
    actorId: string | null;
    actorEmail: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        params.actorId,
        params.actorEmail,
        params.action,
        params.entityType,
        params.entityId ?? null,
        JSON.stringify(params.metadata ?? {}),
        params.ipAddress ?? null,
      ],
    );
  },

  async listAuditLogs(query: AuditLogQuery): Promise<{ items: AuditLogDTO[]; totalCount: number }> {
    const params: unknown[] = [];
    let whereSql = '';
    if (query.action) {
      params.push(`%${query.action}%`);
      whereSql = `WHERE action ILIKE $1`;
    }

    const offset = (query.page - 1) * query.pageSize;
    const countSql = `SELECT COUNT(*)::int AS total FROM audit_logs ${whereSql}`;
    const dataSql = `
      SELECT id, actor_id, actor_email, action, entity_type, entity_id, metadata, ip_address, created_at
      FROM audit_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countRes, dataRes] = await Promise.all([
      pool.query<{ total: number }>(countSql, params),
      pool.query<{
        id: string;
        actor_id: string | null;
        actor_email: string | null;
        action: string;
        entity_type: string;
        entity_id: string | null;
        metadata: Record<string, unknown>;
        ip_address: string | null;
        created_at: Date;
      }>(dataSql, [...params, query.pageSize, offset]),
    ]);

    return {
      totalCount: countRes.rows[0]?.total ?? 0,
      items: dataRes.rows.map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actorEmail: r.actor_email,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        metadata: r.metadata,
        ipAddress: r.ip_address,
        createdAt: r.created_at.toISOString(),
      })),
    };
  },
};
