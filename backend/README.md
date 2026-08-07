# Backend

The backend is an independently deployable Fastify API written in strict TypeScript.

## Commands

```shell
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Configuration is supplied through environment variables and validated at startup. PostgreSQL settings use the `DB_*` variables documented in the root `.env.example`. Logs are newline-delimited JSON outside the test environment.

Versioned SQL migrations live in `migrations/`. Startup acquires a PostgreSQL advisory lock, verifies checksums of previously applied migrations, applies pending migrations in one transaction, and refuses to start if an applied migration was modified.

## HTTP endpoints

- `GET /health` reports process liveness without checking external dependencies.
- `GET /ready` queries PostgreSQL and returns `503 Service Unavailable` when the database cannot be reached.
