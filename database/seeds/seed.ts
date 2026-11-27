import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { createRng, parseSeedArgs } from './config.js';
import { buildCustomerDirectory } from './data.js';
import { seedAuditLogs } from './entities/audit.js';
import { seedQueuesAndTags } from './entities/catalog.js';
import { seedTicketsAndRelations } from './entities/tickets.js';
import { seedUsersAndAgents } from './entities/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(rootDir, '.env') });

export async function seedDatabase(options?: {
  databaseUrl?: string;
  ticketCount?: number;
  seed?: number;
}): Promise<void> {
  const connectionString = options?.databaseUrl ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required to seed database');
  }

  const cli = parseSeedArgs();
  const ticketCount = options?.ticketCount ?? cli.ticketCount;
  const seed = options?.seed ?? cli.seed;
  const rng = createRng(seed);

  const customerCount = Math.min(25_000, Math.max(300, Math.floor(ticketCount / 4)));
  const customers = buildCustomerDirectory(customerCount, rng);

  const client = new pg.Client({ connectionString });
  await client.connect();

  const startedAt = Date.now();
  const nowMs = Date.now();
  console.log(
    `Seeding QueueDesk database (${ticketCount.toLocaleString()} tickets, ${customerCount.toLocaleString()} synthetic customers, seed=${seed})...`,
  );

  try {
    await client.query('BEGIN');

    await client.query(`
      TRUNCATE TABLE
        audit_logs,
        ticket_activity,
        comments,
        ticket_tags,
        tickets,
        tags,
        queues,
        sessions,
        agents,
        users
      RESTART IDENTITY CASCADE
    `);

    const { rows: roleRows } = await client.query<{ id: string; name: string }>(
      'SELECT id, name FROM roles',
    );
    const roleMap = new Map(roleRows.map((r) => [r.name, r.id]));
    if (!roleMap.has('admin') || !roleMap.has('supervisor') || !roleMap.has('support_agent')) {
      throw new Error('Required roles are missing. Run database migrations first.');
    }

    const { userIds, agentIds, emails } = await seedUsersAndAgents(client, roleMap, rng);
    const { weightedQueues, tagIds } = await seedQueuesAndTags(client);
    const { totalComments, totalActivity } = await seedTicketsAndRelations(client, {
      ticketCount,
      customers,
      userIds,
      agentIds,
      weightedQueues,
      tagIds,
      nowMs,
      rng,
    });

    await seedAuditLogs(client, {
      userIds,
      emails,
      nowMs,
      rng,
      summary: {
        ticketCount,
        customerCount,
        agentCount: agentIds.length,
        totalComments,
        totalActivity,
        seed,
        synthetic: true,
      },
    });

    await client.query('COMMIT');
    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(2);
    console.log(
      `Seeding completed in ${elapsedSec}s: ${ticketCount.toLocaleString()} tickets, ` +
        `${customerCount.toLocaleString()} customers, ${agentIds.length} agents, ` +
        `${totalComments.toLocaleString()} comments, ${totalActivity.toLocaleString()} activity records.`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  seedDatabase().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}
