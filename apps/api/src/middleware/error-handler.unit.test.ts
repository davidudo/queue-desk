import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { errorHandler } from '../middleware/error-handler.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';

function createMockRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, status, json };
}

describe('errorHandler middleware', () => {
  it('formats operational AppError with status code and requestId', () => {
    const { res, status, json } = createMockRes();
    const req = { requestId: 'req-123' } as Request;

    errorHandler(new ValidationError('Bad input', { field: 'email' }), req, res, vi.fn());

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Bad input',
        details: { field: 'email' },
      },
      requestId: 'req-123',
    });
  });

  it('maps ForbiddenError and NotFoundError to 403 and 404', () => {
    const mock1 = createMockRes();
    errorHandler(new ForbiddenError(), { requestId: 'r1' } as Request, mock1.res, vi.fn());
    expect(mock1.status).toHaveBeenCalledWith(403);

    const mock2 = createMockRes();
    errorHandler(new NotFoundError('Ticket'), { requestId: 'r2' } as Request, mock2.res, vi.fn());
    expect(mock2.status).toHaveBeenCalledWith(404);
  });

  it('maps PostgreSQL unique violation 23505 to 409 Conflict', () => {
    const { res, status } = createMockRes();
    errorHandler({ code: '23505' }, { requestId: 'r3' } as Request, res, vi.fn());
    expect(status).toHaveBeenCalledWith(409);
  });
});
