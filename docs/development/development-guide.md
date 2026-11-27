# Development & Testing Guide

## Running Locally

1. Ensure PostgreSQL 16 is running and `queuedesk` / `queuedesk_test` databases exist.
2. Copy `.env.example` to `.env`.
3. Run `pnpm install`, `pnpm run db:migrate`, and `pnpm run db:seed`.
4. Start both servers with `pnpm run dev`.

## Testing Strategy

- **Unit Tests (`pnpm run test:unit`)**: Shared Zod schemas & RBAC logic (`@queuedesk/shared`), API utilities & error-handling middleware (`@queuedesk/api`), and React form/table components (`@queuedesk/web`).
- **Integration Tests (`pnpm run test:integration`)**: Supertest suite against `TEST_DATABASE_URL` (`queuedesk_test`), verifying auth, RBAC, ticket lifecycle, search/filtering, and exact `totalCount`.
- **End-to-End Tests (`pnpm run test:e2e`)**: Playwright tests verifying login, ticket browsing/filtering, ticket detail updates, resolution, and role restrictions.

## Benchmarking

For an isolated, repeatable baseline with a database snapshot, correctness
checks, real query plans, and three read/write measurements, follow
[the benchmark guide](../../benchmarks/README.md).

1. Seed a large dataset: `SEED_PROFILE=large pnpm run db:seed` (250,000 tickets).
2. Start the API server (`pnpm run dev:api` or production build).
3. Run Autocannon: `pnpm run benchmark --connections=25 --duration=15 --mode=read`.
4. Inspect PostgreSQL query plans: `pnpm run benchmark:explain`.
