import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { metrics } from '../utils/metrics.js';

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header('x-request-id');
  const requestId = incomingId && incomingId.length <= 128 ? incomingId : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const routeKey = `${req.method} ${req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path}`;
    metrics.record(routeKey, res.statusCode, durationMs);
  });

  next();
}
