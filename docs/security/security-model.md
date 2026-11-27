# Security Model

## Authentication & Session Management

- Passwords are hashed using Node.js `crypto.scrypt` with a 16-byte random salt per user and verified using `crypto.timingSafeEqual`.
- Login issues a signed JWT (`JWT_SECRET`) and stores a SHA-256 hash of the token in the `sessions` table with an explicit expiration timestamp.
- Logout revokes the session (`revoked_at = NOW()`), immediately invalidating the token.

## Authorization (RBAC)

- Roles: `admin`, `supervisor`, `support_agent`.
- Permissions are defined in `packages/shared/src/constants.ts` and enforced server-side via `requirePermission(...)` middleware on every protected route.

## Input & Transport Hardening

- **SQL Injection**: All SQL queries in `apps/api/src/repositories/` use parameterized `$1, $2, ...` bindings.
- **Validation**: Every request body, query, and route parameter is validated with Zod before reaching controllers.
- **Headers & CORS**: Helmet sets security headers; CORS restricts origins to `CORS_ORIGIN`.
- **Rate Limiting**: Global `/api` rate limit and stricter `/api/v1/auth/login` rate limit.
- **Log Redaction**: Pino redacts `authorization`, `cookie`, `set-cookie`, `password`, `passwordHash`, `token`, and `secret`.
- **Audit Logging**: Logins, logouts, and administrative mutations are recorded in `audit_logs`.
