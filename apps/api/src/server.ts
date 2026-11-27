import { createApp } from './app.js';
import { pool } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = createApp();

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info(
    { port: env.API_PORT, host: env.API_HOST, env: env.NODE_ENV },
    'QueueDesk API server started',
  );
});

server.requestTimeout = env.API_REQUEST_TIMEOUT_MS;
server.headersTimeout = env.API_REQUEST_TIMEOUT_MS + 1000;

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Graceful shutdown initiated');

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error closing HTTP server');
      process.exit(1);
    }

    try {
      await pool.end();
      logger.info('Database connection pool closed');
      process.exit(0);
    } catch (poolErr) {
      logger.error({ err: poolErr }, 'Error closing database pool');
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
