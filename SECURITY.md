# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in QueueDesk, please **do not** open a public GitHub issue.

Instead, report it privately to the security maintainers at `security@queuedesk.local` with:

- A clear description of the issue and affected component.
- Steps to reproduce or a minimal proof of concept.
- Potential impact assessment.

## Security Practices

- Passwords are hashed using `crypto.scrypt` with per-user random salts and verified with `crypto.timingSafeEqual`.
- All SQL queries use parameterized bindings (`$1, $2, ...`) to prevent SQL injection.
- Sessions are stored as SHA-256 token hashes in PostgreSQL and can be revoked on logout.
- Sensitive fields (`password`, `authorization`, `cookie`, `token`) are redacted in Pino logs.
