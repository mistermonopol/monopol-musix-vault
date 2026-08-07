---
type: development-handoff
project: Monopol Musix Vault
status: active
updated: 2026-08-07
tags:
  - development/handoff
  - project/monopol-musix-vault
---

# Monopol Musix Vault — Agent Handoff

## Product goal

Monopol Musix Vault is a long-term, self-hosted music platform. Audio remains on storage controlled by the owner; PostgreSQL stores the indexed catalog and user state; this Obsidian vault is the future human-editable knowledge graph for tags, relationships, notes, scenes, influences, and other editorial metadata.

## Repository boundaries

- `backend/` — Fastify API written in strict TypeScript
- `web/` — React/Vite browser player served by nginx
- `frontend/` — reserved for the later Flutter mobile/desktop client
- `musix-vault-brain/` — versioned Obsidian knowledge graph
- `deploy/` — Coolify operations documentation
- `compose.yaml` — production deployment
- `compose.local.yaml` — local-only published ports

Backend and clients share no source code. They communicate through the HTTP API.

## Implemented milestones

1. Repository structure and architecture documentation
2. Docker, PostgreSQL, and Coolify deployment
3. Fastify backend skeleton with structured logging and graceful shutdown
4. PostgreSQL connectivity plus checksum-verified transactional migrations
5. Authentication: first-admin bootstrap, Argon2id passwords, JWT access tokens, rotating hashed refresh sessions, logout, and rate limiting
6. Incremental music scanner with recursive discovery, metadata extraction, normalized artists/albums/genres/tracks, missing-file retention, and scan concurrency control
7. Authenticated full and RFC 9110 byte-range audio streaming with path traversal and symlink escape protection
8. Browser MVP with login, scan, search, catalog, playback, responsive layouts, and same-origin nginx API proxy
9. Selectable screenshot-inspired UI themes at `/spotify`, `/soundcloud`, `/applemusic`, and `/amazonmusic`
10. API access-code boundary described below
11. PostgreSQL-to-Obsidian export with stable IDs, linked entity notes, preserved user regions, atomic writes, and a web sync button
12. Flutter mobile/desktop scaffold for Android, iOS, Windows, macOS, and Linux with API client, access-code login/bootstrap, secure refresh-session restoration, and adaptive Material 3 shell

## Current repository state

Latest pushed commit on `main`:

```text
0c6817e Update agent handoff
```

The backend, web, Obsidian synchronization, and deployment-resilience implementation is committed and pushed. Flutter development is now active under `frontend/`. The only user-owned working-tree change is `musix-vault-brain/.obsidian/workspace.json`; preserve it and do not stage, revert, overwrite, or commit it without explicit permission.

## Current deployment

- Web player: `https://vault.monopol-ai.de`
- Direct API: `https://api.vault.monopol-ai.de`
- Web service internal port: `80`
- API service internal port: `3000`
- PostgreSQL is private and must never publish port `5432`
- Host music directory: `/srv/monopol-musix-vault/music`
- API music mount: `/music`, read-only
- Persistent server vault: `/srv/monopol-musix-vault/brain`
- API brain mount: `/brain`, writable by explicit container UID/GID `10001:10001`

Coolify must route the web domain to service `web:80` and the API domain to `api:3000`. Production Compose uses only internal `expose`; host ports exist only in `compose.local.yaml`.

## Security model

Three independent controls are used:

1. `API_ACCESS_CODE` is configured only in Coolify and must contain at least 16 random characters. Every non-health API request requires it in `X-Access-Code`.
2. User authentication is still required. Protected endpoints need a valid JWT in addition to the access code. Refresh tokens are random, rotated atomically, and stored only as SHA-256 hashes in PostgreSQL.
3. Browser audio uses a short-lived HttpOnly, Secure, SameSite=Strict cookie scoped to `/api/tracks/`. This avoids secrets in stream URLs and browser restrictions on custom native-media headers.

Exemptions from the access-code gate are limited to `GET`/`HEAD` health, readiness, and stream requests. Streams remain JWT-cookie or bearer protected. Access-code comparison uses SHA-256 digests and `timingSafeEqual`; request logging redacts `X-Access-Code`.

The web login form asks for the access code. It is stored only in tab-scoped `sessionStorage`, never in `localStorage`, URLs, service workers, logs, or source code. Direct API clients must send both `X-Access-Code` and bearer tokens where applicable.

Required Coolify secrets:

- `API_ACCESS_CODE`
- `AUTH_SECRET`
- `POSTGRES_PASSWORD`

These must be independent random values and must never be committed to Git or copied into this vault.

## Database and media behavior

Migrations run before API startup under a PostgreSQL advisory lock. Applied migration checksums are immutable. The scanner reads supported audio recursively without following directory symlinks. Unchanged files skip metadata parsing; missing files remain in the catalog with `available = false` rather than being deleted.

Streaming resolves only available tracks, canonicalizes the physical path, verifies containment in the configured library root, and supports full, open-ended, suffix, and bounded byte ranges. Multiple ranges are intentionally unsupported.

## Obsidian synchronization

`POST /brain/sync` requires both the access code and JWT. It reads the available catalog from PostgreSQL and writes stable, linked notes under `Tracks`, `Artists`, `Albums`, and `Genres`. Managed metadata is regenerated; text inside the explicit user-editable delimiters is preserved. Writes use exclusive temporary files and atomic rename, and symlink/path escapes are rejected.

The persistent server vault is separate from Coolify's source checkout. Automatic Git commit/push of server-generated notes is not implemented; add it later as an external, least-privilege operation rather than embedding a GitHub write token in the API.

## Web behavior

The four UI routes use one shared authentication, catalog, scanner, and player implementation. Theme selection is persisted locally. Routing uses the History API without render-time side effects, and nginx explicitly serves `index.html` for every theme subtree so direct reloads work.

The web container no longer depends on API health during startup. nginx uses Docker's runtime DNS resolver for the API upstream. Consequently `/healthz` and all theme routes remain available while the API is stopped; `/api/*` returns sanitized `502`/`504` JSON and recovers after the API restarts.

Only playback is expected to be functional across all theme designs at this stage. Other visible navigation items are presentation placeholders until their corresponding milestones are implemented.

## Flutter client

`frontend/` is a native Flutter client targeting Android, iOS, Windows, macOS, and Linux; browser support remains in `web/`. The API endpoint defaults to `https://api.vault.monopol-ai.de` and can be overridden with `--dart-define=MMV_API_URL=...`. Never compile the access code into the application.

The Flutter client implements login and first-admin bootstrap, sends `X-Access-Code`, restores sessions by rotating the refresh token, keeps the short-lived access token in memory, and stores the access code and refresh token through platform secure storage. It loads and searches the PostgreSQL catalog and uses `media_kit` for JWT-authenticated HTTP range streaming with queue, seek, play/pause, previous/next, buffering, and error states. Stream credentials are sent only in the bearer header, never in URLs. Windows plugin builds require Windows Developer Mode because Flutter needs symlink support.

## Validation baseline

Before handoff, the backend passed strict TypeScript, production build, and 87 automated tests. The web app passed strict TypeScript, production build, and 19 automated tests. The Flutter client passed `flutter analyze` with no issues, all 5 tests passed, and an Android release APK with the native audio engine built successfully. Production Compose configuration validation also passed. Full container E2E covered PostgreSQL migration, auth rotation, real WAV scanning, PostgreSQL-to-Obsidian export, access-code rejection and acceptance, cookie-authenticated full/ranged streaming, web availability while the API was stopped, sanitized proxy failure responses, API proxy recovery, nginx health, and direct theme-route reloads.

## Prioritized TODO

### Immediate deployment

- [ ] Before redeploying, add a strong `API_ACCESS_CODE` secret of at least 16 random characters in Coolify. The API intentionally refuses to start without it.
- [ ] On the Hetzner host, create the persistent brain directory:
  ```shell
  sudo mkdir -p /srv/monopol-musix-vault/brain
  sudo chown -R 10001:10001 /srv/monopol-musix-vault/brain
  sudo chmod -R u+rwX,go-rwx /srv/monopol-musix-vault/brain
  ```
- [ ] Redeploy all services through Coolify.
- [ ] Verify `https://vault.monopol-ai.de/healthz` and `https://api.vault.monopol-ai.de/health`.
- [ ] Verify missing/wrong access codes return `403 ACCESS_DENIED`.
- [ ] Verify login succeeds with the correct code and existing account.
- [ ] Run a library scan, click **Obsidian**, and inspect generated notes under `/srv/monopol-musix-vault/brain`.
- [ ] Verify web playback after deployment and after an access-token refresh.
- [ ] Stop/restart the API once and confirm the web UI remains reachable and its API proxy recovers automatically.
- [ ] Confirm `X-Access-Code` is redacted in production logs.
- [ ] Keep `musix-vault-brain/.obsidian/workspace.json` user-local changes separate from agent commits unless explicitly requested.

### Security hardening

- [ ] Remove or restrict the public direct API domain if native clients do not yet require it.
- [ ] Add trusted-proxy configuration so client-aware rate limiting uses validated proxy headers.
- [ ] Add global request-rate and body-size limits while preserving long-running range streams.
- [ ] Add CSP and review all web security headers.
- [ ] Add automated secret rotation procedures for access code, JWT secret, and database password.
- [ ] Configure encrypted PostgreSQL backups and perform a restoration drill.
- [ ] Add audit events for login, failed access-code attempts, scans, and administrative actions without logging secrets.

### Library and metadata

- [ ] Extract and serve embedded cover artwork with bounded size and MIME validation.
- [ ] Add album, artist, and genre detail endpoints.
- [ ] Add scanner status/history UI and scheduled scans.
- [ ] Improve moved-file identity detection while handling exact duplicate files intentionally.
- [x] Build the initial PostgreSQL-to-Obsidian export contract using stable track/entity IDs.
- [ ] Add bidirectional editorial import with explicit conflict handling: scanner owns technical metadata; Obsidian owns editorial tags, notes, and relationships.
- [ ] Add external least-privilege Git synchronization for the persistent server vault.

### Upload workflow

- [ ] Add admin-only multi-file browser upload.
- [ ] Use a separate writable inbox rather than making the entire music mount writable.
- [ ] Add file signature validation, size limits, free-space checks, `.part` files, atomic completion, safe filenames, and duplicate handling.
- [ ] Trigger an incremental scan after successful imports.
- [ ] Show per-file progress, cancellation, and structured errors.

### Product milestones

- [x] Flutter application scaffold and initial authentication API client
- [ ] Add authenticated Flutter request retry, logout API call, and broader controller/widget tests
- [ ] Add Flutter catalog pagination and further adaptive library refinements; initial query and search are implemented
- [x] Flutter audio player with authenticated range streaming
- [ ] Full library UI and artwork
- [ ] Search refinements
- [ ] Playlists
- [ ] Favorites
- [ ] Recently played and listening history
- [ ] Queue, shuffle, repeat, previous, and next behavior
- [ ] Final accessibility, responsive, performance, and deployment polish

## Start-of-session checklist for the next agent

1. Read `README.md`, `docs/architecture.md`, `backend/README.md`, `web/README.md`, and `deploy/coolify.md`.
2. Read this handoff and inspect `git status` before editing. Preserve user changes, especially Obsidian workspace state.
3. Inspect the latest commit and confirm that only the user's workspace state is locally modified before editing.
4. Confirm Coolify has `API_ACCESS_CODE`, `AUTH_SECRET`, and `POSTGRES_PASSWORD` without printing their values, and confirm the host brain directory has UID/GID `10001:10001` ownership.
5. Redeploy and execute the immediate deployment checks above before starting another feature.
6. For Flutter work, run `dart format --set-exit-if-changed lib test`, `flutter analyze`, and `flutter test` from `frontend/`.
7. Enable Windows Developer Mode before attempting a Windows plugin build.
8. Run backend typecheck/tests/build and web typecheck/tests/build when changing shared API behavior.
9. Work on one milestone at a time; container-test behavior changes before committing.
10. Commit and push only after validation passes.
