# Coolify deployment

Monopol Musix Vault uses the root `compose.yaml` as its Coolify deployment definition. PostgreSQL is private to the internal backend network and is never published directly to the host.

## Create the resource

1. In Coolify, create a new **Docker Compose** resource from the GitHub repository.
2. Select the `main` branch and use `/compose.yaml` as the Compose location.
3. Configure `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `AUTH_SECRET`, and `API_ACCESS_CODE` as runtime environment variables.
4. Generate independent values for `POSTGRES_PASSWORD`, `AUTH_SECRET`, and `API_ACCESS_CODE` with a password manager and store them only in Coolify's secret environment configuration. `API_ACCESS_CODE` must contain at least 16 characters and must not equal either other secret.
5. Create `/srv/monopol-musix-vault/music` on the Coolify host and grant the container read access. Compose mounts this fixed path read-only at `/music`; a fixed source is required because Coolify rejects variable interpolation in volume definitions.
6. Create the persistent Obsidian vault and grant only the API container user write access:

   ```shell
   sudo mkdir -p /srv/monopol-musix-vault/brain
   sudo chown -R 10001:10001 /srv/monopol-musix-vault/brain
   sudo chmod -R u+rwX,go-rwx /srv/monopol-musix-vault/brain
   ```

   Compose mounts it at `/brain`. Do not use Coolify's temporary source checkout as the writable vault.

   To seed the persistent VPS vault once from the versioned `musix-vault-brain/` directory, clone or update the repository in an operator-controlled temporary directory and run:

   ```shell
   sudo rsync -a --ignore-existing /path/to/monopol-musix-vault/musix-vault-brain/ /srv/monopol-musix-vault/brain/
   sudo chown -R 10001:10001 /srv/monopol-musix-vault/brain
   sudo chmod -R u+rwX,go-rwx /srv/monopol-musix-vault/brain
   ```

   `--ignore-existing` deliberately preserves notes already edited or generated on the VPS. Do not repeat this as a destructive deployment copy. The API writes catalog notes through `POST /brain/sync`; external Git synchronization remains a separate least-privilege host operation.
7. Attach persistent storage to the `postgres_data` volume.
8. Assign the public domain to the `web` service on its internal port `80`. Do not publish host ports; Coolify's proxy reaches the service through its Docker network, allowing zero-downtime replacements. The web container proxies same-origin `/api` requests to the private API service.
9. Deploy and wait for PostgreSQL, API, and web health checks to pass. Migrations `009_create_track_artwork.sql` and `010_create_artwork_lookup.sql` add embedded and external artwork storage. Run one full library scan first, then start the missing-cover lookup from the admin Settings area in Web or Flutter.

No database port should be exposed publicly. Route normal users to the `web` service; direct API publication is optional for future native clients and should use a separate API hostname when enabled.

## API access boundary

Every non-health API request requires `X-Access-Code` with the Coolify-only `API_ACCESS_CODE`. Authenticated routes additionally require a valid bearer access token. Browser users enter the access code on the login screen; it is retained only in the current tab's `sessionStorage`. Native or automation clients must send the header explicitly:

```shell
curl https://api.example.com/auth/me \
  -H "X-Access-Code: YOUR_ACCESS_CODE" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Never place the access code in a URL, source code, mobile binary, log, or Git repository. Health/readiness and cookie-authenticated audio stream requests are the only access-code exemptions.

## Streaming proxy

Configure the Coolify proxy to preserve `Authorization`, `Range`, `If-Range`, `Content-Range`, and `Accept-Ranges` headers. Disable response buffering for `/tracks/*/stream` so audio starts promptly and disconnected clients release backend file handles. Keep proxy read timeouts long enough for large lossless files; do not enable proxy-level public caching because streams are authenticated.

## Brain graph and synchronization

`POST /brain/sync` is admin-only and exports PostgreSQL catalog entities into the persistent `/brain` vault. Both Web and Flutter expose an explicit sync button. `GET /brain/graph` exposes a normalized, authenticated and per-user graph projection to Web and Flutter, including catalog metadata, albums, release years, favorites, and playlist membership. Clients never receive filesystem paths, raw vault HTML, plugin code, or an iframe into Obsidian.

The graph API currently projects catalog relationships from PostgreSQL so reads remain stable while Markdown files are being written. The Markdown vault remains the persistent human-editable layer on `/srv/monopol-musix-vault/brain`. Do not place Git credentials in the API container; use a dedicated host job later for Git pull/commit/push and serialize it with brain synchronization.

## Automatic missing-cover lookup

Production Compose enables the bounded lookup job by default. It identifies albums without embedded artwork, queries MusicBrainz at no more than one request per 1100 ms, and downloads validated front-cover bytes from trusted Cover Art Archive/Internet Archive hosts. The public `MUSICBRAINZ_USER_AGENT` contact identifies this deployment; it is not a credential.

Administrators can start and monitor the background job from the gear/Settings area in Web and Flutter. Re-running without **Retry** skips cached matches, no-cover results, and failures. Embedded artwork always wins, and later scans do not remove externally retrieved covers.

Optional Coolify variables are `ARTWORK_LOOKUP_ENABLED`, `ARTWORK_LOOKUP_BATCH_SIZE`, `ARTWORK_LOOKUP_REQUEST_INTERVAL_MS`, `ARTWORK_LOOKUP_TIMEOUT_MS`, and `MUSICBRAINZ_USER_AGENT`. Keep the interval at `1100` ms or higher to respect MusicBrainz rate limits.

## Backups

Configure scheduled volume or PostgreSQL logical backups before storing production data. Keep at least one encrypted backup outside the Coolify host and test restoration regularly.

## Local validation

Copy `.env.example` to `.env`, replace the sample password, and run:

```shell
docker compose -f compose.yaml -f compose.local.yaml config
docker compose -f compose.yaml -f compose.local.yaml up -d --wait
docker compose -f compose.yaml -f compose.local.yaml down
```

`docker compose down` preserves the named database volume. Use `docker compose down --volumes` only when intentionally deleting all local database data.
