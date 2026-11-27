import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorResponse } from '@queuedesk/shared';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';

interface PgErrorLike {
  code?: string;
  detail?: string;
  message?: string;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
    }
    const payload: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
      requestId,
    };
    res.status(err.statusCode).json(payload);
    return;
  }

  // Handle PostgreSQL constraint & timeout errors gracefully
  const pgErr = err as PgErrorLike;
  if (pgErr && typeof pgErr.code === 'string') {
    if (pgErr.code === '23505') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'A record with that unique value already exists' },
        requestId,
      } satisfies ApiErrorResponse);
      return;
    }
    if (pgErr.code === '23503') {
      res.status(400).json({
        error: { code: 'INVALID_REFERENCE', message: 'Referenced entity does not exist' },
        requestId,
      } satisfies ApiErrorResponse);
      return;
    }
    if (pgErr.code === '57014') {
      logger.warn({ err, requestId }, 'PostgreSQL statement timeout exceeded');
      res.status(504).json({
        error: { code: 'QUERY_TIMEOUT', message: 'Database query exceeded timeout limit' },
        requestId,
      } satisfies ApiErrorResponse);
      return;
    }
  }

  logger.error({ err, requestId }, 'Unhandled server error');

  const isProd = env.NODE_ENV === 'production';
  const message = isProd
    ? 'An unexpected internal error occurred'
    : err instanceof Error
      ? err.message
      : 'Unknown error';

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
    },
    requestId,
  } satisfies ApiErrorResponse);
}
