# ADR 0001: Modular Monolith API and Explicit Parameterized SQL

## Status

Accepted

## Context

QueueDesk requires a maintainable, production-oriented backend that supports complex ticket filtering, exact total counts, transactional activity logging, and serves as the baseline for a subsequent database performance optimization exercise.

## Decision

1. **Modular Monolith**: Organize `apps/api` into `routes -> controllers -> services -> repositories` rather than splitting into microservices.
2. **Explicit Parameterized SQL (`pg`)**: Write ticket retrieval and counting queries directly in `apps/api/src/repositories/ticket.repository.ts` instead of using an ORM.

## Consequences

- Query plans (`EXPLAIN (ANALYZE, BUFFERS)`) map 1:1 to readable SQL in `ticket.repository.ts`.
- Future index additions or count-strategy refactors can be isolated to `database/migrations/` and `ticket.repository.ts` without changing REST API contracts.
