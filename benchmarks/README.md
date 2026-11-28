# QueueDesk Performance Benchmarks

This directory is reserved for load-testing and query-plan verification scripts.

- `autocannon` and `pg` are installed in the root workspace (`devDependencies`).
- The local `queuedesk` database is seeded with `250,000` synthetic tickets (`SEED_PROFILE=large`).
- Target read workload: `GET /api/v1/tickets?page=1&pageSize=25&status=open&priority=high&sortBy=updated_at&sortOrder=desc` at `20` concurrent connections (`p95 <= 500 ms`).
- Target write workload: `PATCH /api/v1/tickets/:id` at `5` concurrent connections.
