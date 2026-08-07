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

## Authentication

The first installation creates its administrator through `POST /auth/bootstrap`. This endpoint is transactionally limited to the first account and returns `409 Conflict` after bootstrap. Passwords require 12–128 characters and are stored with Argon2id. Login and bootstrap are rate-limited.

Access tokens are short-lived HS256 JWTs intended for the `Authorization: Bearer` header. Refresh tokens are opaque random values; only their SHA-256 hashes are persisted. Refresh rotates and revokes the previous session atomically. Configure a unique `AUTH_SECRET` of at least 32 random characters in the deployment secret store.

## HTTP endpoints

- `GET /health` reports process liveness without checking external dependencies.
- `GET /ready` queries PostgreSQL and returns `503 Service Unavailable` when the database cannot be reached.
- `POST /auth/bootstrap` creates the first administrator.
- `POST /auth/login` authenticates an existing user.
- `POST /auth/refresh` rotates a refresh token and issues a new token pair.
- `POST /auth/logout` revokes a refresh token.
- `GET /auth/me` returns the user associated with a valid bearer access token.
- `POST /library/scan` performs an authenticated incremental scan of the configured library.

## Music scanning

The host path configured by `MUSIC_PATH` is mounted read-only at `/music`. Scans recursively discover supported audio formats without following symbolic-link directories, extract embedded metadata, and transactionally maintain normalized artists, albums, genres, tracks, and their relationships. Unchanged files avoid metadata parsing; unavailable files are retained and marked missing rather than deleted. Per-file failures are returned in the scan result and do not abort healthy files.
