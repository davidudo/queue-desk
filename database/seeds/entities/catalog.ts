import type pg from 'pg';
import { QUEUE_DEFS, TAG_DEFS } from '../data.js';

export interface SeededCatalogResult {
  weightedQueues: Array<{ value: string; weight: number }>;
  tagIds: string[];
}

export async function seedQueuesAndTags(client: pg.Client): Promise<SeededCatalogResult> {
  const weightedQueues: Array<{ value: string; weight: number }> = [];
  for (const q of QUEUE_DEFS) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO queues (name, slug, description, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id`,
      [q.name, q.slug, q.description],
    );
    weightedQueues.push({ value: rows[0]!.id, weight: q.weight });
  }

  const tagIds: string[] = [];
  for (const t of TAG_DEFS) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING id`,
      [t.name, t.color],
    );
    tagIds.push(rows[0]!.id);
  }

  return { weightedQueues, tagIds };
}
