# Deployment Guide

## Container Architecture

- `infrastructure/docker/api.Dockerfile`: Multi-stage Node 22 Alpine build running as non-root `node` user.
- `infrastructure/docker/web.Dockerfile`: Multi-stage Vite build served by Nginx 1.27 Alpine on port `8080` as non-root `nginx` user.
- `docker-compose.prod.yml`: Production Compose stack pulling versioned GHCR images (`IMAGE_TAG` required, never `latest` by default).

## GitHub Actions CI/CD

- **CI (`.github/workflows/ci.yml`)**: Runs formatting, linting, typechecks, unit tests with coverage, PostgreSQL-backed integration tests, production builds, and `npm audit`.
- **Publish (`.github/workflows/publish.yml`)**: Builds and pushes `queuedesk-api` and `queuedesk-web` images to `ghcr.io` with `sha-<commit>` and semver tags, then scans with Trivy.
- **Deploy (`.github/workflows/deploy.yml`)**: Manual `workflow_dispatch` restricted to `main` branch and `production` environment. Uses concurrency locks, pulls the specified `image_tag`, starts containers, and polls `/ready`.

## Required GitHub Secrets

- `DEPLOY_HOST`: Target Linux server hostname or IP.
- `DEPLOY_USER`: SSH deployment user.
- `DEPLOY_SSH_KEY`: Private SSH key for deployment user.
- `PRODUCTION_URL`: Public URL for environment metadata.
