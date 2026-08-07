# Monopol Musix Vault Web

Standalone React/Vite client for Monopol Musix Vault. It provides first-admin bootstrap and login, a searchable library, scan controls, and a persistent native-audio player in a responsive dark interface.

## Requirements

- Node.js 22+
- npm 10+
- Backend on `http://localhost:3000` for local development

## Development

```sh
npm install
npm run dev
```

Vite serves the app (normally on `http://localhost:5173`) and proxies `/api/*` to `http://localhost:3000/*`. Keeping frontend and API same-origin is intentional: it makes native audio playback compatible with authenticated media requests through the service worker.

## Commands

```sh
npm run typecheck
npm test
npm run build
```

## API contract

All client requests use the `/api` browser prefix. Vite and nginx remove that prefix before forwarding to the backend.

| Method | Browser URL | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/bootstrap` | Create first administrator and issue tokens |
| `POST` | `/api/auth/login` | Issue tokens |
| `POST` | `/api/auth/refresh` | Rotate refresh token and issue access token |
| `POST` | `/api/auth/logout` | Revoke refresh token |
| `GET` | `/api/library/tracks?search=&limit=&offset=` | List/search tracks |
| `POST` | `/api/library/scan` | Scan configured library roots |
| `GET` | `/api/tracks/:id/stream` | Stream audio, including byte ranges |

Auth responses must be `{ accessToken, refreshToken, user }`. The catalog endpoint should return `{ items, total }`; array and `{ tracks }` responses are also accepted for compatibility. Each track must have `id` and `title`. Artist strings or `{ name }` objects and album strings or `{ title }` objects are normalized by the client.

**Backend gap:** at the time this client was created, the repository backend implements auth, scan, and stream routes but does not expose `GET /library/tracks`. That endpoint must be added server-side for library results to populate. The UI presents an error/retry state while it is unavailable.

## Authentication and streaming design

The access token exists only in the JavaScript module's memory. The rotating refresh token is persisted in `localStorage` so a session survives reloads. On startup the client exchanges it for a fresh token pair. API requests include the bearer token and retry once after a successful, deduplicated refresh.

An `<audio>` element cannot set an `Authorization` header. Therefore `public/sw.js` intercepts only same-origin requests whose path begins `/api/tracks/`. The app sends the current access token to the worker via `postMessage`; the worker clones the original request and adds `Authorization`. Cloning preserves `Range`, `If-Range`, method, credentials, and cancellation semantics. It does not cache audio or tokens. A stream `401` causes the worker to notify open app windows so they can refresh. The user may need to press play again after an expired stream request because a native media element's failed request cannot be replayed transparently by application code.

The worker is deliberately same-origin and narrowly scoped by request path. First-load registration happens after window load; authenticated playback starts only after login/session restoration, giving the worker time to claim the page. Browsers without service-worker support can use the UI but cannot authenticate native stream requests.

### Threat model and current SPA trade-off

`localStorage` is the practical persistence mechanism for the current backend contract, but it is readable by any JavaScript running on this origin. A successful XSS attack or compromised same-origin dependency can steal the refresh token. Mitigations here include no runtime third-party scripts, no HTML injection, in-memory access tokens, refresh rotation, same-origin APIs, and restrictive production response headers. Do not place untrusted applications on the same origin.

For stronger production security, change the backend to store the refresh token in a `Secure; HttpOnly; SameSite=Strict` cookie, protect state-changing cookie requests against CSRF, and return only the access token to JavaScript. Add a nonce/hash-based Content Security Policy once the deployment's script requirements are finalized. Token revocation and short access-token lifetimes remain backend responsibilities.

## Production image

Build from this directory:

```sh
docker build -t monopol-musix-vault-web .
docker run --rm -p 8080:80 monopol-musix-vault-web
```

The nginx config expects the backend to resolve as `backend:3000` (for example, a Compose service named `backend`). It serves SPA routes through `index.html`, proxies `/api`, forwards authorization and range request headers, exposes range response headers, and disables proxy buffering for streaming. Update `proxy_pass` in `nginx/default.conf` if your service name differs.

## Accessibility and responsive behavior

Controls use native buttons, labels, status/alert regions, visible focus rings, and descriptive media labels. Motion respects `prefers-reduced-motion`. The track table collapses secondary columns on narrow screens, and player controls reflow for touch-sized mobile layouts.
