import type { AuthUser } from '@queuedesk/shared';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: AuthUser;
      authToken?: string;
    }
  }
}

export {};
