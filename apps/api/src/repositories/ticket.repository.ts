import type {
  CreateCommentInput,
  CreateTicketInput,
  RoleName,
  TagDTO,
  TicketActivityDTO,
  TicketCommentDTO,
  TicketDetailDTO,
  TicketListItemDTO,
  TicketListQuery,
  TicketPriority,
  TicketSortField,
  TicketStatus,
  UpdateTicketInput,
} from '@queuedesk/shared';
import type pg from 'pg';
import { pool, withTransaction } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

interface TicketListRow {
  id: string;
  ticket_number: number;
  subject: string;
  description_preview: string;
  status: TicketStatus;
  priority: TicketPriority;
  queue_id: string;
  queue_name: string;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  requester_name: string;
  requester_email: string;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
}

interface TicketDetailRow extends TicketListRow {
  description: string;
}

const SORT_EXPRESSION_MAP: Record<TicketSortField, string> = {
  created_at: 't.created_at',
  updated_at: 't.updated_at',
  ticket_number: 't.ticket_number',
  status: 't.status',
  priority:
    "CASE t.priority WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END",
};

function buildTicketWhereClause(query: TicketListQuery): {
  whereSql: string;
  params: unknown[];
} {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.search) {
    params.push(`%${query.search}%`);
    const idx = params.length;
    conditions.push(`(t.subject ILIKE $${idx} OR t.description ILIKE $${idx})`);
  }

  if (query.status) {
    params.push(query.status);
    conditions.push(`t.status = $${params.length}`);
  }

  if (query.priority) {
    params.push(query.priority);
    conditions.push(`t.priority = $${params.length}`);
  }

  if (query.queueId) {
    params.push(query.queueId);
    conditions.push(`t.queue_id = $${params.length}`);
  }

  if (query.unassigned) {
    conditions.push(`t.assigned_agent_id IS NULL`);
  } else if (query.assignedAgentId) {
    params.push(query.assignedAgentId);
    conditions.push(`t.assigned_agent_id = $${params.length}`);
  }

  if (query.tagId) {
    params.push(query.tagId);
    conditions.push(
      `EXISTS (SELECT 1 FROM ticket_tags tt WHERE tt.ticket_id = t.id AND tt.tag_id = $${params.length})`,
    );
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereSql, params };
}

async function loadTagsForTickets(
  ticketIds: string[],
  db: pg.Pool | pg.PoolClient = pool,
): Promise<Map<string, TagDTO[]>> {
  const map = new Map<string, TagDTO[]>();
  if (ticketIds.length === 0) {
    return map;
  }

  const { rows } = await db.query<{
    ticket_id: string;
    id: string;
    name: string;
    color: string;
    created_at: Date;
  }>(
    `SELECT tt.ticket_id, tg.id, tg.name, tg.color, tg.created_at
     FROM ticket_tags tt
     JOIN tags tg ON tg.id = tt.tag_id
     WHERE tt.ticket_id = ANY($1::uuid[])
     ORDER BY tg.name ASC`,
    [ticketIds],
  );

  for (const row of rows) {
    const list = map.get(row.ticket_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at.toISOString(),
    });
    map.set(row.ticket_id, list);
  }

  return map;
}

function mapTicketRow(row: TicketListRow, tags: TagDTO[]): TicketListItemDTO {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    subject: row.subject,
    descriptionPreview: row.description_preview,
    status: row.status,
    priority: row.priority,
    queueId: row.queue_id,
    queueName: row.queue_name,
    assignedAgentId: row.assigned_agent_id,
    assignedAgentName: row.assigned_agent_name,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    tags,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  };
}

export const ticketRepository = {
  /**
   * Lists tickets with filtering, deterministic sorting, server-side pagination,
   * and an exact total count query.
   *
   * Note: These parameterized SQL queries are intentionally straightforward and
   * unoptimized (exact COUNT(*) + unindexed filter/sort predicates) to serve as
   * the baseline for subsequent database performance analysis.
   */
  async listTickets(query: TicketListQuery): Promise<{
    items: TicketListItemDTO[];
    totalCount: number;
  }> {
    const { whereSql, params } = buildTicketWhereClause(query);
    const sortExpr = SORT_EXPRESSION_MAP[query.sortBy];
    const sortDir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
    const offset = (query.page - 1) * query.pageSize;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM tickets t
      ${whereSql}
    `;

    const dataParams = [...params, query.pageSize, offset];
    const limitParam = `$${params.length + 1}`;
    const offsetParam = `$${params.length + 2}`;

    const dataSql = `
      SELECT
        t.id,
        t.ticket_number,
        t.subject,
        LEFT(t.description, 180) AS description_preview,
        t.status,
        t.priority,
        t.queue_id,
        q.name AS queue_name,
        t.assigned_agent_id,
        au.full_name AS assigned_agent_name,
        t.requester_name,
        t.requester_email,
        t.created_at,
        t.updated_at,
        t.resolved_at
      FROM tickets t
      JOIN queues q ON q.id = t.queue_id
      LEFT JOIN agents a ON a.id = t.assigned_agent_id
      LEFT JOIN users au ON au.id = a.user_id
      ${whereSql}
      ORDER BY ${sortExpr} ${sortDir}, t.id ASC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const [countRes, dataRes] = await Promise.all([
      pool.query<{ total: number }>(countSql, params),
      pool.query<TicketListRow>(dataSql, dataParams),
    ]);

    const totalCount = countRes.rows[0]?.total ?? 0;
    const ticketIds = dataRes.rows.map((r) => r.id);
    const tagsMap = await loadTagsForTickets(ticketIds);

    const items = dataRes.rows.map((row) => mapTicketRow(row, tagsMap.get(row.id) ?? []));
    return { items, totalCount };
  },

  async getTicketById(id: string): Promise<TicketDetailDTO> {
    const { rows } = await pool.query<TicketDetailRow>(
      `SELECT
         t.id,
         t.ticket_number,
         t.subject,
         LEFT(t.description, 180) AS description_preview,
         t.description,
         t.status,
         t.priority,
         t.queue_id,
         q.name AS queue_name,
         t.assigned_agent_id,
         au.full_name AS assigned_agent_name,
         t.requester_name,
         t.requester_email,
         t.created_at,
         t.updated_at,
         t.resolved_at
       FROM tickets t
       JOIN queues q ON q.id = t.queue_id
       LEFT JOIN agents a ON a.id = t.assigned_agent_id
       LEFT JOIN users au ON au.id = a.user_id
       WHERE t.id = $1`,
      [id],
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError('Ticket');
    }

    const [tagsMap, commentsRes, activityRes] = await Promise.all([
      loadTagsForTickets([id]),
      pool.query<{
        id: string;
        ticket_id: string;
        author_id: string;
        author_name: string;
        author_role: RoleName;
        body: string;
        is_internal: boolean;
        created_at: Date;
      }>(
        `SELECT
           c.id,
           c.ticket_id,
           c.author_id,
           u.full_name AS author_name,
           r.name AS author_role,
           c.body,
           c.is_internal,
           c.created_at
         FROM comments c
         JOIN users u ON u.id = c.author_id
         JOIN roles r ON r.id = u.role_id
         WHERE c.ticket_id = $1
         ORDER BY c.created_at ASC`,
        [id],
      ),
      pool.query<{
        id: string;
        ticket_id: string;
        actor_id: string | null;
        actor_name: string | null;
        action: string;
        field_name: string | null;
        old_value: string | null;
        new_value: string | null;
        created_at: Date;
      }>(
        `SELECT
           ta.id,
           ta.ticket_id,
           ta.actor_id,
           u.full_name AS actor_name,
           ta.action,
           ta.field_name,
           ta.old_value,
           ta.new_value,
           ta.created_at
         FROM ticket_activity ta
         LEFT JOIN users u ON u.id = ta.actor_id
         WHERE ta.ticket_id = $1
         ORDER BY ta.created_at DESC`,
        [id],
      ),
    ]);

    const comments: TicketCommentDTO[] = commentsRes.rows.map((c) => ({
      id: c.id,
      ticketId: c.ticket_id,
      authorId: c.author_id,
      authorName: c.author_name,
      authorRole: c.author_role,
      body: c.body,
      isInternal: c.is_internal,
      createdAt: c.created_at.toISOString(),
    }));

    const activity: TicketActivityDTO[] = activityRes.rows.map((a) => ({
      id: a.id,
      ticketId: a.ticket_id,
      actorId: a.actor_id,
      actorName: a.actor_name ?? 'System',
      action: a.action,
      fieldName: a.field_name,
      oldValue: a.old_value,
      newValue: a.new_value,
      createdAt: a.created_at.toISOString(),
    }));

    return {
      ...mapTicketRow(row, tagsMap.get(id) ?? []),
      description: row.description,
      comments,
      activity,
    };
  },

  async createTicket(input: CreateTicketInput, actorUserId: string): Promise<TicketDetailDTO> {
    const ticketId = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO tickets (
           subject, description, status, priority, queue_id,
           assigned_agent_id, created_by_user_id, requester_name, requester_email
         )
         VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          input.subject,
          input.description,
          input.priority,
          input.queueId,
          input.assignedAgentId ?? null,
          actorUserId,
          input.requesterName,
          input.requesterEmail,
        ],
      );
      const id = rows[0]!.id;

      if (input.tagIds.length > 0) {
        await client.query(
          `INSERT INTO ticket_tags (ticket_id, tag_id)
           SELECT $1, UNNEST($2::uuid[])
           ON CONFLICT DO NOTHING`,
          [id, input.tagIds],
        );
      }

      await client.query(
        `INSERT INTO ticket_activity (ticket_id, actor_id, action, field_name, old_value, new_value)
         VALUES ($1, $2, 'ticket_created', 'status', NULL, 'open')`,
        [id, actorUserId],
      );

      return id;
    });

    return this.getTicketById(ticketId);
  },

  async updateTicket(
    id: string,
    input: UpdateTicketInput,
    actorUserId: string,
  ): Promise<TicketDetailDTO> {
    await withTransaction(async (client) => {
      const { rows: existingRows } = await client.query<{
        id: string;
        subject: string;
        description: string;
        status: TicketStatus;
        priority: TicketPriority;
        queue_id: string;
        assigned_agent_id: string | null;
        resolved_at: Date | null;
      }>(
        `SELECT id, subject, description, status, priority, queue_id, assigned_agent_id, resolved_at
         FROM tickets
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );

      const current = existingRows[0];
      if (!current) {
        throw new NotFoundError('Ticket');
      }

      const nextSubject = input.subject ?? current.subject;
      const nextDescription = input.description ?? current.description;
      const nextStatus = input.status ?? current.status;
      const nextPriority = input.priority ?? current.priority;
      const nextQueueId = input.queueId ?? current.queue_id;
      const nextAssignedAgentId =
        input.assignedAgentId !== undefined ? input.assignedAgentId : current.assigned_agent_id;

      let nextResolvedAt = current.resolved_at;
      if (input.status !== undefined) {
        if (input.status === 'resolved' || input.status === 'closed') {
          nextResolvedAt = current.resolved_at ?? new Date();
        } else {
          nextResolvedAt = null;
        }
      }

      await client.query(
        `UPDATE tickets
         SET subject = $1,
             description = $2,
             status = $3,
             priority = $4,
             queue_id = $5,
             assigned_agent_id = $6,
             resolved_at = $7
         WHERE id = $8`,
        [
          nextSubject,
          nextDescription,
          nextStatus,
          nextPriority,
          nextQueueId,
          nextAssignedAgentId,
          nextResolvedAt,
          id,
        ],
      );

      const activities: Array<{
        action: string;
        field: string;
        oldVal: string | null;
        newVal: string | null;
      }> = [];
      if (input.status !== undefined && input.status !== current.status) {
        activities.push({
          action: 'status_changed',
          field: 'status',
          oldVal: current.status,
          newVal: input.status,
        });
      }
      if (input.priority !== undefined && input.priority !== current.priority) {
        activities.push({
          action: 'priority_changed',
          field: 'priority',
          oldVal: current.priority,
          newVal: input.priority,
        });
      }
      if (input.queueId !== undefined && input.queueId !== current.queue_id) {
        activities.push({
          action: 'queue_moved',
          field: 'queue_id',
          oldVal: current.queue_id,
          newVal: input.queueId,
        });
      }
      if (
        input.assignedAgentId !== undefined &&
        input.assignedAgentId !== current.assigned_agent_id
      ) {
        activities.push({
          action: 'assignee_changed',
          field: 'assigned_agent_id',
          oldVal: current.assigned_agent_id,
          newVal: input.assignedAgentId,
        });
      }
      if (
        (input.subject !== undefined && input.subject !== current.subject) ||
        (input.description !== undefined && input.description !== current.description)
      ) {
        activities.push({
          action: 'details_updated',
          field: 'subject',
          oldVal: current.subject,
          newVal: nextSubject,
        });
      }

      for (const act of activities) {
        await client.query(
          `INSERT INTO ticket_activity (ticket_id, actor_id, action, field_name, old_value, new_value)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, actorUserId, act.action, act.field, act.oldVal, act.newVal],
        );
      }
    });

    return this.getTicketById(id);
  },

  async addComment(
    ticketId: string,
    input: CreateCommentInput,
    actorUserId: string,
  ): Promise<TicketCommentDTO> {
    return withTransaction(async (client) => {
      const { rows: ticketRows } = await client.query<{ id: string }>(
        'SELECT id FROM tickets WHERE id = $1',
        [ticketId],
      );
      if (!ticketRows[0]) {
        throw new NotFoundError('Ticket');
      }

      const { rows } = await client.query<{
        id: string;
        ticket_id: string;
        author_id: string;
        body: string;
        is_internal: boolean;
        created_at: Date;
      }>(
        `INSERT INTO comments (ticket_id, author_id, body, is_internal)
         VALUES ($1, $2, $3, $4)
         RETURNING id, ticket_id, author_id, body, is_internal, created_at`,
        [ticketId, actorUserId, input.body, input.isInternal],
      );

      await client.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [ticketId]);

      await client.query(
        `INSERT INTO ticket_activity (ticket_id, actor_id, action, field_name, old_value, new_value)
         VALUES ($1, $2, 'comment_added', 'comment', NULL, $3)`,
        [ticketId, actorUserId, input.isInternal ? 'internal_note' : 'public_reply'],
      );

      const { rows: userRows } = await client.query<{ full_name: string; role_name: RoleName }>(
        `SELECT u.full_name, r.name AS role_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1`,
        [actorUserId],
      );

      const comment = rows[0]!;
      const author = userRows[0]!;

      return {
        id: comment.id,
        ticketId: comment.ticket_id,
        authorId: comment.author_id,
        authorName: author.full_name,
        authorRole: author.role_name,
        body: comment.body,
        isInternal: comment.is_internal,
        createdAt: comment.created_at.toISOString(),
      };
    });
  },

  async addTag(ticketId: string, tagId: string, actorUserId: string): Promise<TicketDetailDTO> {
    await withTransaction(async (client) => {
      const { rows: tRows } = await client.query('SELECT id FROM tickets WHERE id = $1', [
        ticketId,
      ]);
      if (!tRows[0]) throw new NotFoundError('Ticket');

      const { rows: tagRows } = await client.query<{ name: string }>(
        'SELECT name FROM tags WHERE id = $1',
        [tagId],
      );
      if (!tagRows[0]) throw new NotFoundError('Tag');

      const res = await client.query(
        `INSERT INTO ticket_tags (ticket_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [ticketId, tagId],
      );

      if ((res.rowCount ?? 0) > 0) {
        await client.query(
          `INSERT INTO ticket_activity (ticket_id, actor_id, action, field_name, old_value, new_value)
           VALUES ($1, $2, 'tag_added', 'tag', NULL, $3)`,
          [ticketId, actorUserId, tagRows[0].name],
        );
      }
    });

    return this.getTicketById(ticketId);
  },

  async removeTag(ticketId: string, tagId: string, actorUserId: string): Promise<TicketDetailDTO> {
    await withTransaction(async (client) => {
      const { rows: tagRows } = await client.query<{ name: string }>(
        'SELECT name FROM tags WHERE id = $1',
        [tagId],
      );
      const res = await client.query(
        `DELETE FROM ticket_tags WHERE ticket_id = $1 AND tag_id = $2`,
        [ticketId, tagId],
      );

      if ((res.rowCount ?? 0) > 0) {
        await client.query(
          `INSERT INTO ticket_activity (ticket_id, actor_id, action, field_name, old_value, new_value)
           VALUES ($1, $2, 'tag_removed', 'tag', $3, NULL)`,
          [ticketId, actorUserId, tagRows[0]?.name ?? tagId],
        );
      }
    });

    return this.getTicketById(ticketId);
  },
};
