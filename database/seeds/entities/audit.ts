import type pg from 'pg';
import { pick, type Rng } from '../config.js';

const AUDIT_ACTIONS = [
  { action: 'auth.login', entityType: 'session' },
  { action: 'queue.updated', entityType: 'queue' },
  { action: 'agent.updated', entityType: 'agent' },
  { action: 'tag.created', entityType: 'tag' },
  { action: 'user.role_updated', entityType: 'user' },
] as const;

export async function seedAuditLogs(
  client: pg.Client,
  params: {
    userIds: string[];
    emails: string[];
    nowMs: number;
    rng: Rng;
    summary: Record<string, unknown>;
  },
): Promise<void> {
  const { userIds, emails, nowMs, rng, summary } = params;

  for (let i = 0; i < 60; i++) {
    const actorIdx = Math.floor(rng() * Math.min(10, userIds.length));
    const evt = pick(AUDIT_ACTIONS, rng);
    const ts = new Date(nowMs - Math.floor(rng() * 30 * 86400_000));
    await client.query(
      `INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, metadata, ip_address, created_at)
       VALUES ($1, $2, $3, $4, NULL, $5::jsonb, $6, $7)`,
      [
        userIds[actorIdx],
        emails[actorIdx],
        evt.action,
        evt.entityType,
        JSON.stringify({ synthetic: true, sequence: i + 1 }),
        `10.24.${(i % 12) + 1}.${(i % 200) + 10}`,
        ts,
      ],
    );
  }

  await client.query(
    `INSERT INTO audit_logs (actor_id, actor_email, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, 'system.seed_completed', 'database', NULL, $3::jsonb)`,
    [userIds[0], 'admin@queuedesk.local', JSON.stringify(summary)],
  );
}
