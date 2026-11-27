# Database Schema & Entity-Relationship Diagram

```mermaid
erDiagram
  roles ||--o{ users : "assigned_to"
  users ||--o| agents : "profile"
  users ||--o{ sessions : "authenticates"
  queues ||--o{ tickets : "contains"
  agents ||--o{ tickets : "assigned_to"
  users ||--o{ tickets : "created_by"
  tickets ||--o{ ticket_tags : "tagged_with"
  tags ||--o{ ticket_tags : "applied_to"
  tickets ||--o{ comments : "has"
  users ||--o{ comments : "authors"
  tickets ||--o{ ticket_activity : "records"
  users ||--o{ audit_logs : "performs"
```

## Baseline Performance Characteristics

By design, `database/migrations/001_initial_schema.sql` omits composite filtering/sorting indexes and trigram text-search indexes on `tickets`, and `apps/api/src/repositories/ticket.repository.ts` executes an exact `SELECT COUNT(*)::int` alongside paginated data retrieval. This preserves realistic baseline bottlenecks for subsequent `EXPLAIN (ANALYZE, BUFFERS)` investigation.
