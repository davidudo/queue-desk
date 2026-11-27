# Contributing to QueueDesk

## Development Workflow

1. Create a feature branch from `main`.
2. Install dependencies with `pnpm install`.
3. Follow Conventional Commits (`feat(api): ...`, `fix(web): ...`, `docs: ...`). Commit messages are validated by `commitlint`.
4. Ensure all checks pass before opening a pull request:
   ```bash
   pnpm run format:check
   pnpm run lint
   pnpm run typecheck
   pnpm run test:unit
   pnpm run test:integration
   ```

## Code Standards

- TypeScript `strict: true` across all packages.
- Explicit parameterized SQL queries in `apps/api/src/repositories/`.
- Validate all external inputs with Zod schemas in `@queuedesk/shared`.
