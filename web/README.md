# Monopol Musix Vault Web

Standalone React/Vite client for Monopol Musix Vault. It provides first-admin bootstrap and login, a searchable library, favorites, playlists, devices, an interactive Brain graph, role-aware settings and administration, embedded cover artwork, and a persistent native-audio player with four responsive, selectable interface designs.

## Requirements

- Node.js 22+
- npm 10+
- Backend on `http://localhost:3000` for local development

## Development

```sh
npm install
npm run dev
```

Vite serves the app (normally on `http://localhost:5173`) and proxies `/api/*` to `http://localhost:3000/*`. Keeping frontend and API same-origin is intentional: native audio playback can send the backend's HttpOnly stream cookie without exposing credentials to JavaScript.

## Interface routes

The authenticated library is available in four screenshot-inspired designs. They share the same catalog, search, scan, authentication, and native audio state:

- `/spotify` — near-black three-column library with a purple feature area
- `/soundcloud` — centered grid interface with an orange accent
- `/applemusic` — charcoal editorial interface with a red accent
- `/amazonmusic` — black and warm-brown interface with a cyan accent

The persistent **UI Design** menu changes routes with the History API and supports browser back/forward navigation. The selected route is saved in `localStorage`. Opening `/` or an unknown SPA route redirects to the saved design, or `/spotify` when no choice has been saved. No third-party brand assets, logos, or image hotlinks are used. Embedded album artwork is fetched as an authenticated blob when `hasArtwork` is true; deterministic generated artwork remains the fallback.

Production hosting must retain the existing SPA fallback to `index.html` for all four direct routes.

## Settings and administration

Authenticated users can open **Settings** from the gear entry in the vault navigation. The view shows the session email and role, the active theme, and safe same-origin API route information; it never displays access codes, tokens, cookies, or backend secrets. Theme selection is available as a shortcut, and the dense-layout preference is stored locally under `mmv.ui-settings`.

Users whose session role is exactly `admin` also receive Brain maintenance controls and detailed sync counts/errors. Brain Sync uses the existing `POST /api/brain/sync` client operation, and the graph links reload data when the Brain view opens. Mutation controls are hidden from all other roles, including in the Brain view; backend authorization remains authoritative.

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
| `GET` | `/api/tracks/:id/artwork` | Fetch embedded JPEG, PNG, or WebP cover bytes |
| `GET` | `/api/brain/graph` | Load the current user's music relationship graph |
| `POST` | `/api/brain/sync` | Admin-only Brain/Obsidian sync |

Auth responses must be `{ accessToken, refreshToken, user }` and establish the HttpOnly cookie used by the stream route. The catalog endpoint should return `{ items, total }`; array and `{ tracks }` responses are also accepted for compatibility. Each track must have `id`, `title`, and `hasArtwork`. Artist strings or `{ name }` objects and album strings or `{ title }` objects are normalized by the client. Brain nodes include `id`, `label`, `type`, and scalar `properties`; supported node types are track, artist, album, genre, playlist, and favorites. The Brain view searches labels and metadata, filters by node type, shows typed connections, and exposes sync status/errors.

**Backend gap:** at the time this client was created, the repository backend implements auth, scan, and stream routes but does not expose `GET /library/tracks`. That endpoint must be added server-side for library results to populate. The UI presents an error/retry state while it is unavailable.

## Authentication and streaming design

The access token exists only in the JavaScript module's memory. The rotating refresh token is persisted in `localStorage` so a session can survive reloads. The required server access code is sent in the `X-Access-Code` header and is saved in `sessionStorage` only after successful login or bootstrap. It is therefore scoped to the current browser tab and disappears when that tab session ends. Normal `/api` calls—including login, bootstrap, refresh, logout, catalog, and scan—include this header. Bearer-authenticated requests still retry once after a successful, deduplicated refresh. Artwork uses the same access-code and JWT headers, is converted to a cached object URL, and is revoked after its final mounted consumer releases it; credentials are never placed in image URLs.

Startup restoration requires both the saved refresh token and the tab's access code. If the access code is absent, the app shows login immediately and leaves the refresh token untouched; successful authentication replaces it. Explicit logout clears both values. A rejected refresh clears the invalid session data.

Audio is intentionally separate from the API client. The native `<audio>` element requests `/api/tracks/:id/stream` directly and sends the existing same-origin HttpOnly cookie. The backend stream route is exempt from `X-Access-Code`, so the access code is never added to an audio request. The app does not place the code in URLs, `localStorage`, service workers, logs, or media requests. Legacy service-worker registrations from older web builds are unregistered on load.

### Threat model and current SPA trade-off

The refresh token remains readable by JavaScript because it is stored in `localStorage`; the access code is also JavaScript-readable while its tab is open because it is stored in `sessionStorage`. A successful XSS attack or compromised same-origin dependency could steal either value. Mitigations include no runtime third-party scripts, no HTML injection, in-memory access tokens, tab-scoped access-code persistence, refresh rotation, same-origin APIs, and restrictive production response headers. Do not place untrusted applications on the same origin.

For stronger production security, store the refresh token in a separate `Secure; HttpOnly; SameSite=Strict` cookie, protect state-changing cookie requests against CSRF, and return only the access token to JavaScript. The stream cookie must remain HttpOnly, Secure in production, appropriately SameSite-scoped, narrowly scoped where practical, and revocable. Add a nonce/hash-based Content Security Policy once deployment script requirements are finalized. Token revocation and short access-token lifetimes remain backend responsibilities.

## Production image

Build from this directory:

```sh
docker build -t monopol-musix-vault-web .
docker run --rm -p 8080:80 monopol-musix-vault-web
```

The nginx config resolves the Compose API service at `api:3000` through Docker's embedded DNS at request time. The web container therefore starts independently and continues serving `/healthz`, static assets, and all SPA theme routes while the API is absent or restarting. During an outage, `/api/*` returns a sanitized JSON `502` or `504`; proxying recovers automatically after Docker DNS observes the restarted API.

Nginx strips the browser's `/api` prefix before forwarding, preserves authorization, access-code, cookie, range, and forwarding headers, exposes range response headers, and disables request and response buffering for streaming. `API_ACCESS_CODE` remains required by the API and the client continues sending it as `X-Access-Code`; web availability does not bypass or weaken API authentication.

## Accessibility and responsive behavior

Controls use native buttons, labels, menu semantics, status/alert regions, visible focus rings, and descriptive media labels. The UI Design picker is keyboard operable and announces the active design. Motion respects `prefers-reduced-motion`. Sidebars and secondary metadata collapse at tablet/mobile widths, artwork grids reflow, and player controls simplify for touch-sized layouts.
