# QueueDesk

QueueDesk is an internal support-ticket management platform built with TypeScript, React, Express, and PostgreSQL in a pnpm workspaces monorepo.

## Features

- **Role-Based Access Control (RBAC)**: `admin`, `supervisor`, and `support_agent` roles enforced on both API endpoints and frontend routes.
- **Operations Dashboard**: Status totals, priority breakdown, queue distribution, recently updated tickets, and agent workload overview.
- **Ticket Management**: Create, search, filter (status, priority, queue, assignee, tag), sort, paginate with exact total counts, update properties, add public/internal comments, manage tags, resolve/reopen, and inspect activity history.
- **Administration**: Manage support queues, tags, agent availability, user roles, and inspect audit logs.
- **Observability & Security**: Structured Pino logging with redaction, `x-request-id` correlation, `/health`, `/ready`, `/metrics`, Helmet security headers, rate limiting, and OpenAPI/Swagger UI at `/api/docs`.

## Technology Stack

- **Frontend**: React 18, TypeScript (strict), Vite, Tailwind CSS, TanStack Query, TanStack Table, React Router, React Hook Form, Zod.
- **Backend**: Node.js LTS, TypeScript (strict), Express, PostgreSQL (`pg`), Zod, Pino, OpenAPI / Swagger UI.
- **Testing & Benchmarking**: Vitest, React Testing Library, Supertest, Playwright, Autocannon.
- **Infrastructure**: Docker, Docker Compose, Nginx, GitHub Actions.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL 16 (running locally or via Docker)

## Quick Start (Local Development)

1. **Install dependencies**:
   ```bash
   pnpm install
   ```
2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Ensure PostgreSQL is running and databases `queuedesk` and `queuedesk_test` exist:
   ```bash
   createdb queuedesk
   createdb queuedesk_test
   ```
3. **Run migrations & seed synthetic data**:
   ```bash
   pnpm run db:migrate
   pnpm run db:seed
   ```
   To seed a large dataset (e.g., 250,000 tickets):
   ```bash
   SEED_PROFILE=large pnpm run db:seed
   ```
4. **Start development servers**:
   ```bash
   pnpm run dev
   ```
   - Web UI: `http://localhost:5173`
   - API: `http://localhost:4000`
   - Swagger UI: `http://localhost:4000/api/docs`

### Synthetic Development Accounts

| Role          | Email                        | Password              |
| :------------ | :--------------------------- | :-------------------- |
| Admin         | `admin@queuedesk.local`      | `QueueDesk!Admin2026` |
| Supervisor    | `supervisor@queuedesk.local` | `QueueDesk!Super2026` |
| Support Agent | `agent1@queuedesk.local`     | `QueueDesk!Agent2026` |

## Workspace Commands

| Command                      | Description                                                     |
| :--------------------------- | :-------------------------------------------------------------- |
| `pnpm run dev`               | Start API and Web dev servers concurrently                      |
| `pnpm run build`             | Build shared, API, and Web production artifacts                 |
| `pnpm run typecheck`         | Run TypeScript strict type checks across workspaces             |
| `pnpm run lint`              | Run ESLint across the repository                                |
| `pnpm run format`            | Format files with Prettier                                      |
| `pnpm run format:check`      | Check formatting without modifying files                        |
| `pnpm run test:unit`         | Run unit tests across shared, API, and Web                      |
| `pnpm run test:integration`  | Run API integration tests against `TEST_DATABASE_URL`           |
| `pnpm run test:e2e`          | Run Playwright end-to-end tests                                 |
| `pnpm run test:coverage`     | Run unit tests with coverage thresholds                         |
| `pnpm run db:migrate`        | Apply pending SQL migrations                                    |
| `pnpm run db:seed`           | Seed synthetic data (`SEED_PROFILE=test\|small\|medium\|large`) |
| `pnpm run db:reset`          | Drop/recreate public schema and re-run migrations               |
| `pnpm run benchmark`         | Run Autocannon HTTP benchmark                                   |
| `pnpm run benchmark:explain` | Run PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)`                     |

## Docker & Production

```bash
docker compose up --build
```

For production deployment with versioned GHCR images, see [docs/deployment/deployment-guide.md](docs/deployment/deployment-guide.md).

## Documentation

- [System Architecture](docs/architecture/system-architecture.md)
- [Database Schema & ERD](docs/architecture/database-schema.md)
- [REST API Reference](docs/api/rest-api.md)
- [Security Model](docs/security/security-model.md)
- [Development Guide](docs/development/development-guide.md)
- [Deployment Guide](docs/deployment/deployment-guide.md)
- [Operations Runbook](docs/operations/runbook.md)
- [ADR 0001: Modular Monolith & Explicit SQL](docs/adr/0001-monolith-api-and-explicit-sql.md)
