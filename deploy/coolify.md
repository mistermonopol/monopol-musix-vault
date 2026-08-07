# Coolify deployment

Monopol Musix Vault uses the root `compose.yaml` as its Coolify deployment definition. PostgreSQL is private to the internal backend network and is never published directly to the host.

## Create the resource

1. In Coolify, create a new **Docker Compose** resource from the GitHub repository.
2. Select the `main` branch and use `/compose.yaml` as the Compose location.
3. Configure `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `AUTH_SECRET` as runtime environment variables.
4. Generate `POSTGRES_PASSWORD` and `AUTH_SECRET` with a password manager and store them only in Coolify's secret environment configuration.
5. Set `MUSIC_PATH` to the music directory on the Coolify host. Compose mounts it read-only at `/music` inside the API container.
6. Attach persistent storage to the `postgres_data` volume.
7. Deploy and wait for both PostgreSQL and API health checks to pass.

No database port should be exposed publicly. The backend service will join the private `backend` network when introduced and will be the only public application service.

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
