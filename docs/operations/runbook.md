# Operations Runbook

## Health & Readiness Inspection

- **Liveness**: `curl -fsS http://localhost:4000/health`
- **Readiness & DB Pool**: `curl -fsS http://localhost:4000/ready`
- **Metrics (Latency & Error Counts)**: `curl -fsS http://localhost:4000/metrics`

## Log Inspection

Logs are emitted in structured JSON via Pino with `requestId` correlation:

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=200 api
```

## Database Backup & Restoration

```bash
# Backup
pg_dump "$DATABASE_URL" --format=custom --file="queuedesk_$(date +%Y%m%d_%H%M%S).dump"

# Restore
pg_restore --clean --if-exists --dbname="$DATABASE_URL" queuedesk_backup.dump
```

## Deployment Rollback

Re-run the `Deploy Production` GitHub Actions workflow with the previous known-good `image_tag` (e.g., `sha-<previous-commit>`), or on the host:

```bash
IMAGE_TAG=sha-<previous-commit> docker compose -f docker-compose.prod.yml up -d
```

## Secret Rotation

1. Generate a new 32+ character `JWT_SECRET` and update `.env` on the host.
2. Restart the `api` service (`docker compose -f docker-compose.prod.yml up -d api`). Existing sessions will require re-authentication.
3. Rotate PostgreSQL password via `ALTER USER` and update `DATABASE_URL` before restarting `api`.
