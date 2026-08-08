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

Configuration is supplied through environment variables and validated at startup. PostgreSQL settings use the `DB_*` variables documented in the root `.env.example`. `API_ACCESS_CODE` is required, must contain at least 16 characters, and should be generated as a high-entropy secret. Logs are newline-delimited JSON outside the test environment; the access-code header is redacted.

Versioned SQL migrations live in `migrations/`. Startup acquires a PostgreSQL advisory lock, verifies checksums of previously applied migrations, applies pending migrations in one transaction, and refuses to start if an applied migration was modified.

## Authentication

Every endpoint requires `X-Access-Code: <API_ACCESS_CODE>` except `GET`/`HEAD` requests to `/health`, `/ready`, and `/tracks/:trackId/stream`. The stream exemption applies only to the access-code gate: streaming remains protected by a JWT bearer token or the HttpOnly `mmv_stream` cookie. JWT-protected endpoints require both the access code and a valid JWT. Bootstrap, login, and refresh require the access code; logout and `me` require both layers.

The first installation creates its administrator through `POST /auth/bootstrap`. This endpoint is transactionally limited to the first account and returns `409 Conflict` after bootstrap. Passwords require 12–128 characters and are stored with Argon2id. Login and bootstrap are rate-limited.

Access tokens are short-lived HS256 JWTs intended for the `Authorization: Bearer` header. Refresh tokens are opaque random values; only their SHA-256 hashes are persisted. Refresh rotates and revokes the previous session atomically. Configure a unique `AUTH_SECRET` of at least 32 random characters in the deployment secret store.

## Obsidian catalog sync

`POST /brain/sync` exports the available PostgreSQL catalog into the writable vault mount configured by `OBSIDIAN_PATH`. It creates relationship-linked notes under `Tracks`, `Artists`, `Albums`, and `Genres`, preserves text inside the generated user-editable delimiters, rejects symlink escapes, and replaces managed content atomically. The endpoint requires both `X-Access-Code` and an administrator bearer token.

`GET /brain/graph` generates a normalized graph directly from the available PostgreSQL catalog and the authenticated user's personal data. It does not read or serve Markdown/HTML, expose an iframe, execute vault content, or return filesystem paths. Node IDs are namespaced (`track:<uuid>`, `artist:<uuid>`, `album:<uuid>`, `genre:<uuid>`, `playlist:<uuid>`, and the user-local `favorites:mine`). Every node has `{ id, label, type, properties }`. Track properties contain `{ year, releaseDate, durationSeconds, codec, favorite, hasArtwork }`; unavailable values are `null`. Album properties contain `year`, playlist properties contain `description` and `updatedAt`, and other collection properties are empty. Edges have `{ id, source, target, type }`, where `type` is `artist`, `album`, `genre`, `playlist`, or `favorite`. Playlist and favorite nodes, edges, and track `favorite` flags are selected exclusively with the JWT `userId`.

The exporter does not run Git commands or push credentials. Synchronizing the persistent server vault to GitHub remains an external operational responsibility.

## HTTP endpoints

- `GET /health` reports process liveness without checking external dependencies.
- `GET /ready` queries PostgreSQL and returns `503 Service Unavailable` when the database cannot be reached.
- `POST /auth/bootstrap` creates the first administrator.
- `POST /auth/login` authenticates an existing user.
- `POST /auth/refresh` rotates a refresh token and issues a new token pair.
- `POST /auth/logout` revokes a refresh token.
- `GET /auth/me` returns the user associated with a valid bearer access token.
- `GET /favorites/tracks` lists the current user's available favorite tracks with catalog metadata.
- `PUT /favorites/tracks/:trackId` idempotently favorites an available track and returns the favorite; missing tracks return `404`.
- `DELETE /favorites/tracks/:trackId` idempotently removes a favorite and returns `204`.
- `POST /library/scan` performs an authenticated incremental scan of the configured library.
- `POST /admin/artwork/lookup` starts an admin-only, non-blocking missing-cover run. The optional body is `{ retry: boolean }`; `retry: true` reconsiders albums with cached attempts. Returns `202` with current progress, `409` while a run is active, or `503` when disabled.
- `GET /admin/artwork/lookup` returns the admin-only in-process job status and path-free progress counts/errors.
- `POST /brain/sync` writes catalog notes and relationships into the Obsidian vault (admin only).
- `GET /brain/graph` returns the current user's `{ nodes: BrainNode[], edges: BrainEdge[] }` graph from PostgreSQL.
- `GET /listening/recent?limit=25` returns `{ items }`; `limit` is 1–100.
- `POST /listening/events` accepts `{ trackId, eventType, positionSeconds?, occurredAt? }` and returns `201 { event: { id } }`. Event types are `started`, `progress`, `paused`, and `completed`.
- `GET /listening/positions/:trackId` returns `{ position: { trackId, positionSeconds, updatedAt } }`.
- `PUT /listening/positions/:trackId` idempotently upserts `{ positionSeconds }` and returns `{ position }`; unchanged values preserve `updatedAt` for throttling-friendly writes.
- `GET /playlists` returns `{ items: Playlist[] }`; `POST /playlists` accepts `{ name, description? }` and returns `201 { playlist }`.
- `GET /playlists/:id` returns `{ playlist }`; `PATCH /playlists/:id` replaces metadata with `{ name, description? }`; `DELETE /playlists/:id` returns `204`.
- `PUT /playlists/:id/items` replaces the ordered contents with `{ trackIds: string[] }` and returns `{ playlist }`. Item order matches array order.
- `GET /devices` returns `{ items: Device[] }`; `POST /devices` accepts `{ name, kind? }` and returns `201 { device }`; `DELETE /devices/:id` revokes the device and linked refresh sessions, returning `204`.
- `GET /queue/:deviceId` returns `{ queue }`; `PUT /queue/:deviceId` saves `{ items, currentIndex?, positionSeconds? }`. `items` is an array of at most 500 available track UUIDs.
- `POST /queue/transfer` accepts `{ sourceDeviceId, targetDeviceId }`, explicitly copies the owned snapshot, and returns `{ queue, autoPlay: false }`. It never starts playback.
- `GET /tracks/:trackId/artwork` returns persisted embedded artwork bytes for an available track, or `404` when absent.
- `GET /tracks/:trackId/stream` streams an available track and supports one RFC 9110 byte range.
- `HEAD /tracks/:trackId/stream` returns stream metadata without opening the audio file.

Favorites, listening, playlist, device, queue, graph, and artwork endpoints require both `X-Access-Code` and `Authorization: Bearer <access-token>`. IDs must be UUIDs where documented. User resources are scoped by the JWT user ID; cross-user resources are returned as `404` rather than disclosed. Favorites are removed automatically when either the user or track is deleted.

Playlist responses have `{ id, name, description, createdAt, updatedAt, items }`; each item has `{ id, trackId, position }`. Device responses have `{ id, name, kind, createdAt, lastSeenAt }`. Queue responses have `{ deviceId, items, currentIndex, positionSeconds, updatedAt }`. Queue transfer is state transfer only: clients remain responsible for an explicit playback command.

## Embedded artwork

Scans persist the first safe embedded JPEG, PNG, or WebP picture for each changed track. Declared MIME and file signatures must agree; empty and images larger than 5 MiB are ignored, and the database repeats the MIME and size constraints. Embedded artwork always replaces external artwork. Rescanning a changed track without embedded art removes stale embedded artwork but preserves MusicBrainz artwork. `GET /tracks/:trackId/artwork` requires both `X-Access-Code` and `Authorization: Bearer <access-token>` (secrets are never accepted in URLs), returns the raw bytes with `Content-Type`, `Content-Length`, `Cache-Control: private, max-age=86400`, and `X-Content-Type-Options: nosniff`, and returns the path-free `ARTWORK_NOT_FOUND` response for missing or unavailable tracks. Catalog and favorite track objects include `hasArtwork: boolean` so Web and Flutter clients can avoid speculative requests.

## Missing-cover lookup

Missing-cover lookup is explicit and never runs as part of a library scan. Set `ARTWORK_LOOKUP_ENABLED=true` to enable admin-triggered runs. `MUSICBRAINZ_USER_AGENT` defaults to `MonopolMusixVault/0.4.0 (https://vault.monopol-ai.de; derdildi@gmail.com)` and should identify the deployment; MusicBrainz requires a meaningful User-Agent but no API key. `ARTWORK_LOOKUP_REQUEST_INTERVAL_MS` defaults to and cannot be lower than `1100`, `ARTWORK_LOOKUP_BATCH_SIZE` defaults to `50` (maximum `500`), and `ARTWORK_LOOKUP_TIMEOUT_MS` defaults to `10000`.

Each run selects distinct albums with available tracks missing artwork and no cached attempt, up to the configured batch bound. It searches MusicBrainz release groups by album, album artist, and year, requires score `>= 90`, exact normalized album and artist text, and a compatible year when supplied. Cover Art Archive `front-500` downloads permit only manually validated HTTPS redirects to Cover Art Archive or Internet Archive hosts, enforce the timeout and 5 MiB limit, and require matching JPEG, PNG, or WebP MIME/signature. A matched cover is inserted only for still-missing tracks in that album, with source, release-group MBID, score, and provenance. Successes and failures are cached per album; pass `{ "retry": true }` for an explicit retry. External errors remain per-item and status responses never include filesystem paths.

## Audio streaming

Streaming requires a bearer access token and resolves only available catalog tracks. Filesystem paths are canonicalized and constrained to their configured library root, including protection against traversal and symbolic-link escapes. Responses advertise byte-range support, return `206 Partial Content` for valid ranges, and return `416 Range Not Satisfiable` with the resource size for unsatisfiable ranges. Client disconnects destroy the underlying file stream.

## Music scanning

The host path configured by `MUSIC_PATH` is mounted read-only at `/music`. Scans recursively discover supported audio formats without following symbolic-link directories, extract embedded metadata and bounded artwork, and transactionally maintain normalized artists, albums, genres, tracks, and their relationships. Unchanged files avoid metadata parsing; unavailable files are retained and marked missing rather than deleted. Per-file failures are returned in the scan result and do not abort healthy files.
