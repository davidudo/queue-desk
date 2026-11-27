import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const { rows: qRows } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM queues ORDER BY name LIMIT 1`,
    );
    const sampleQueueId = qRows[0]?.id;

    const queries: Array<{ label: string; sql: string; params: unknown[] }> = [
      {
        label: '1. Exact COUNT(*) for status = open',
        sql: `EXPLAIN (ANALYZE, BUFFERS) SELECT COUNT(*)::int AS total FROM tickets t WHERE t.status = $1`,
        params: ['open'],
      },
      {
        label: '2. Filtered & sorted ticket list (status + priority, ORDER BY updated_at DESC)',
        sql: `EXPLAIN (ANALYZE, BUFFERS)
              SELECT t.id, t.ticket_number, t.subject, t.status, t.priority, t.updated_at
              FROM tickets t
              WHERE t.status = $1 AND t.priority = $2
              ORDER BY t.updated_at DESC, t.id ASC
              LIMIT 25 OFFSET 0`,
        params: ['open', 'high'],
      },
      {
        label: '3. Subject/description ILIKE search',
        sql: `EXPLAIN (ANALYZE, BUFFERS)
              SELECT t.id, t.ticket_number, t.subject
              FROM tickets t
              WHERE t.subject ILIKE $1 OR t.description ILIKE $1
              ORDER BY t.created_at DESC, t.id ASC
              LIMIT 25 OFFSET 0`,
        params: ['%checkout%'],
      },
    ];

    if (sampleQueueId) {
      queries.push({
        label: `4. Queue-filtered list (${qRows[0]!.name})`,
        sql: `EXPLAIN (ANALYZE, BUFFERS)
              SELECT t.id, t.ticket_number, t.subject, t.status
              FROM tickets t
              WHERE t.queue_id = $1 AND t.status = $2
              ORDER BY t.created_at DESC, t.id ASC
              LIMIT 25 OFFSET 0`,
        params: [sampleQueueId, 'open'],
      });
    }

    for (const q of queries) {
      console.log(`\n--- ${q.label} ---`);
      const res = await client.query<{ 'QUERY PLAN': string }>(q.sql, q.params);
      for (const row of res.rows) {
        console.log(row['QUERY PLAN']);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('EXPLAIN runner failed:', err);
  process.exit(1);
});
