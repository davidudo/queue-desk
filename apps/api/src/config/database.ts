import pg from 'pg';
import { env } from './env.js';
import { logger } from './logger.js';

const { Pool } = pg;

export function createPool(connectionString = env.DATABASE_URL): pg.Pool {
  const pool = new Pool({
    connectionString,
    max: env.PG_POOL_MAX,
    idleTimeoutMillis: env.PG_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.PG_CONNECTION_TIMEOUT_MS,
    statement_timeout: env.PG_STATEMENT_TIMEOUT_MS,
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected PostgreSQL pool error');
  });

  return pool;
}

export const pool = createPool();

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  targetPool: pg.Pool = pool,
): Promise<T> {
  const client = await targetPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDatabaseHealth(targetPool: pg.Pool = pool): Promise<boolean> {
  try {
    await targetPool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export function getPoolStats(targetPool: pg.Pool = pool) {
  return {
    totalCount: targetPool.totalCount,
    idleCount: targetPool.idleCount,
    waitingCount: targetPool.waitingCount,
  };
}
