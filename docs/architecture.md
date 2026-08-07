# Architecture

## System context

Monopol Musix Vault consists of two independently deployable applications:

1. A stateless TypeScript backend that exposes an HTTP API, indexes mounted music files, streams audio, and persists user and library metadata in PostgreSQL.
2. A Flutter client that consumes only the public HTTP API and manages playback on the user's device.

PostgreSQL is the system of record for application metadata. Original audio files remain on user-controlled storage mounted read-only into the backend in production.

## Backend boundaries

The backend follows a pragmatic clean architecture:

- `domain` contains business entities, value objects, and domain rules. It has no framework or persistence dependencies.
- `application` contains use cases and the ports they require.
- `infrastructure` implements persistence, filesystem, authentication, and other external adapters.
- `interfaces` exposes application use cases through HTTP and maps transport concerns.

Dependencies point inward. Domain and application code do not import HTTP, database, or filesystem implementations.

## Frontend boundaries

The Flutter application is organized by product feature. Shared networking, persistence, design-system, logging, and error primitives live in `core`; each feature owns its data, domain, and presentation concerns when those separations are useful. Simple features remain simple rather than receiving empty layers.

## API boundary

The backend and frontend share no source code or build tooling. API compatibility is maintained through a versioned HTTP contract. Authentication uses short-lived access tokens and rotating refresh tokens. Audio streaming supports standard HTTP range requests.

## Operational principles

- Secrets are supplied only through environment variables or deployment secret stores.
- Logs are structured JSON in deployed environments and never contain credentials or raw tokens.
- Database migrations are explicit and run before application startup.
- Music mounts are read-only by default.
- Health and readiness checks distinguish process health from dependency availability.
