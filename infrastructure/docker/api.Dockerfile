# syntax=docker/dockerfile:1

FROM node:24.1.0-alpine3.20 AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --filter @queuedesk/shared --filter @queuedesk/api

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @queuedesk/shared build && pnpm --filter @queuedesk/api build

FROM node:24.1.0-alpine3.20 AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN pnpm install --prod --frozen-lockfile --filter @queuedesk/shared --filter @queuedesk/api && \
    pnpm store prune

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY database ./database

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/server.js"]
