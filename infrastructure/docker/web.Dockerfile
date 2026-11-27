# syntax=docker/dockerfile:1

FROM node:22.12.0-alpine3.20 AS builder
WORKDIR /app

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_ENABLE_DEV_QUICK_LOGIN=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ENABLE_DEV_QUICK_LOGIN=$VITE_ENABLE_DEV_QUICK_LOGIN

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile --filter @queuedesk/shared --filter @queuedesk/web

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm --filter @queuedesk/shared build && pnpm --filter @queuedesk/web build

FROM nginx:1.27.3-alpine AS runner

COPY infrastructure/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && chown -R nginx:nginx /var/run/nginx.pid

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8080/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
