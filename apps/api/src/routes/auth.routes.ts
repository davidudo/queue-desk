import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema } from '@queuedesk/shared';
import { env } from '../config/env.js';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { asyncHandler } from '../utils/errors.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

authRouter.post(
  '/login',
  authLimiter,
  validateRequest({ body: loginSchema }),
  asyncHandler(authController.login),
);

authRouter.post('/logout', authenticate, asyncHandler(authController.logout));
authRouter.get('/me', authenticate, asyncHandler(authController.me));
