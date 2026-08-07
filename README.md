# Monopol Musix Vault

Monopol Musix Vault is a self-hosted music library and player designed to keep a personal collection private, portable, and under its owner's control.

## Repository layout

- `backend/` — TypeScript HTTP API, library scanner, metadata persistence, and audio streaming
- `web/` — React browser player and same-origin API/stream proxy
- `frontend/` — Flutter application for mobile and desktop
- `musix-vault-brain/` — versioned Obsidian knowledge graph for editorial music metadata
- `deploy/` — Docker and Coolify deployment configuration
- `docs/` — Architecture, development, and operations documentation

The backend, web player, and Flutter client are independently buildable. Clients communicate with the backend only through the documented HTTP API; the web container provides a same-origin `/api` proxy for browser security and authenticated native audio playback.

## Prerequisites

Development will require:

- Node.js 22 LTS or newer
- npm 10 or newer
- Flutter 3.32 or newer
- Docker Engine 27 or newer with Docker Compose v2
- PostgreSQL 17 (provided through Docker for local development)

## Status

Application components are added incrementally and validated at each milestone.

## Local infrastructure

Copy `.env.example` to `.env`, set strong authentication and PostgreSQL secrets, and start local infrastructure with `docker compose -f compose.yaml -f compose.local.yaml up -d --wait`. The local override publishes the web player at `http://localhost:8080` and the API at `http://localhost:3000`; production services remain internal behind Coolify's proxy. The stack expects a readable music library at `/srv/monopol-musix-vault/music` on the Docker host. See `deploy/coolify.md` for production deployment guidance.
