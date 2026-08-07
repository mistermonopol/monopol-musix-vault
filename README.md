# Monopol Musix Vault

Monopol Musix Vault is a self-hosted music library and player designed to keep a personal collection private, portable, and under its owner's control.

## Repository layout

- `backend/` — TypeScript HTTP API, library scanner, metadata persistence, and audio streaming
- `frontend/` — Flutter application for mobile, desktop, and web
- `musix-vault-brain/` — versioned Obsidian knowledge graph for editorial music metadata
- `deploy/` — Docker and Coolify deployment configuration
- `docs/` — Architecture, development, and operations documentation

The backend and frontend are independently buildable and deployable. They communicate only through the documented HTTP API.

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

Copy `.env.example` to `.env`, set strong authentication and PostgreSQL secrets, and start the infrastructure with `docker compose up -d --wait`. The Compose stack expects a readable music library at `/srv/monopol-musix-vault/music` on the Docker host. See `deploy/coolify.md` for production deployment guidance.
