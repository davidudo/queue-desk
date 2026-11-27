# REST API Reference

Base URL: `/api/v1`

Interactive OpenAPI / Swagger UI is served at `/api/docs` (and raw JSON at `/api/docs.json`).

## Authentication

- `POST /api/v1/auth/login` — Authenticate with email and password; returns JWT and sets `qd_token` HttpOnly cookie.
- `POST /api/v1/auth/logout` — Revoke current session in PostgreSQL and clear cookie.
- `GET /api/v1/auth/me` — Return authenticated user profile.

## Dashboard & Tickets

- `GET /api/v1/dashboard/summary` — Status totals, priority counts, queue distribution, recent tickets, agent workload.
- `GET /api/v1/tickets` — Server-paginated ticket list with `search`, `status`, `priority`, `queueId`, `assignedAgentId`, `unassigned`, `tagId`, `sortBy`, `sortOrder`, and exact `meta.totalCount`.
- `POST /api/v1/tickets` — Create a ticket.
- `GET /api/v1/tickets/:id` — Ticket detail with comments and activity history.
- `PATCH /api/v1/tickets/:id` — Update ticket fields, status, priority, queue, or assignee.
- `POST /api/v1/tickets/:id/comments` — Add public reply or internal note.
- `POST /api/v1/tickets/:id/tags` / `DELETE /api/v1/tickets/:id/tags/:tagId` — Manage ticket tags.

## Administration

- `GET / POST / PATCH /api/v1/admin/queues`
- `GET / POST / DELETE /api/v1/admin/tags`
- `GET / PATCH /api/v1/admin/agents`
- `GET / POST /api/v1/admin/users` & `PATCH /api/v1/admin/users/:id/role`
- `GET /api/v1/admin/audit-logs`

## Observability

- `GET /health` — Liveness probe.
- `GET /ready` — Readiness probe (verifies PostgreSQL connectivity and reports pool stats).
- `GET /metrics` — Request counts, error counts, and latency p95/avg.
