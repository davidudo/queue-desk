import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { checkDatabaseHealth, getPoolStats } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { openApiSpec } from './docs/openapi.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestContextMiddleware } from './middleware/request-id.js';
import { v1Router } from './routes/index.js';
import { NotFoundError } from './utils/errors.js';
import { metrics } from './utils/metrics.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Origin not allowed by CORS'));
        }
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: env.API_BODY_LIMIT }));
  app.use(cookieParser());
  app.use(requestContextMiddleware);

  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ requestId: req.requestId }),
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/ready',
      },
    }),
  );

  app.use(
    '/api',
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => env.NODE_ENV === 'test',
    }),
  );

  // Liveness probe
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'queuedesk-api',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe
  app.get('/ready', async (_req, res) => {
    const dbHealthy = await checkDatabaseHealth();
    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json({
      status: dbHealthy ? 'ready' : 'unavailable',
      checks: {
        database: dbHealthy ? 'up' : 'down',
      },
      pool: getPoolStats(),
      timestamp: new Date().toISOString(),
    });
  });

  // Basic observability metrics
  app.get('/metrics', (_req, res) => {
    res.status(200).json({
      ...metrics.snapshot(),
      pool: getPoolStats(),
    });
  });

  // OpenAPI & Swagger UI
  app.get('/api/docs.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // Versioned API routes
  app.use('/api/v1', v1Router);

  app.use((_req, _res, next) => {
    next(new NotFoundError('Endpoint'));
  });

  app.use(errorHandler);

  return app;
}
