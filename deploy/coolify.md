# Coolify deployment

Monopol Musix Vault uses the root `compose.yaml` as its Coolify deployment definition. PostgreSQL is private to the internal backend network and is never published directly to the host.

## Create the resource

1. In Coolify, create a new **Docker Compose** resource from the GitHub repository.
2. Select the `main` branch and use `/compose.yaml` as the Compose location.
3. Configure `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `AUTH_SECRET` as runtime environment variables.
4. Generate `POSTGRES_PASSWORD` and `AUTH_SECRET` with a password manager and store them only in Coolify's secret environment configuration.
5. Create `/srv/monopol-musix-vault/music` on the Coolify host and grant the container read access. Compose mounts this fixed path read-only at `/music`; a fixed source is required because Coolify rejects variable interpolation in volume definitions.
6. Attach persistent storage to the `postgres_data` volume.
7. Assign the public domain to the `web` service on port `80`. The web container proxies same-origin `/api` requests to the private API service.
8. Deploy and wait for PostgreSQL, API, and web health checks to pass.

No database port should be exposed publicly. Route normal users to the `web` service; direct API publication is optional for future native clients and should use a separate API hostname when enabled.

## Streaming proxy

Configure the Coolify proxy to preserve `Authorization`, `Range`, `If-Range`, `Content-Range`, and `Accept-Ranges` headers. Disable response buffering for `/tracks/*/stream` so audio starts promptly and disconnected clients release backend file handles. Keep proxy read timeouts long enough for large lossless files; do not enable proxy-level public caching because streams are authenticated.

## Backups

Configure scheduled volume or PostgreSQL logical backups before storing production data. Keep at least one encrypted backup outside the Coolify host and test restoration regularly.

## Local validation

Copy `.env.example` to `.env`, replace the sample password, and run:

```shell
docker compose config
docker compose up -d --wait
docker compose down
```

`docker compose down` preserves the named database volume. Use `docker compose down --volumes` only when intentionally deleting all local database data.
