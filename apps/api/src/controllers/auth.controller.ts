import type { Request, Response } from 'express';
import type { LoginInput } from '@queuedesk/shared';
import { env } from '../config/env.js';
import { AUTH_COOKIE_NAME } from '../middleware/auth.js';
import { authService } from '../services/auth.service.js';

export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    const input = req.body as LoginInput;
    const result = await authService.login(input, {
      ipAddress: req.ip ?? null,
      userAgent: req.header('user-agent') ?? null,
    });

    res.cookie(AUTH_COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      expires: new Date(result.expiresAt),
      path: '/',
    });

    res.status(200).json({
      data: result,
      requestId: req.requestId,
    });
  },

  async logout(req: Request, res: Response): Promise<void> {
    if (req.authToken && req.user) {
      await authService.logout(req.authToken, req.user, req.ip ?? null);
    }

    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      path: '/',
    });

    res.status(200).json({
      data: { loggedOut: true },
      requestId: req.requestId,
    });
  },

  async me(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      data: { user: req.user },
      requestId: req.requestId,
    });
  },
};
