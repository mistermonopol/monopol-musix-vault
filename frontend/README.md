# Monopol Musix Vault Flutter client

Native mobile and desktop client for Android, iOS, Windows, macOS, and Linux. The React application remains the browser client.

## Current milestone

- Material 3 application shell
- Configurable API endpoint using the production web `/api` proxy by default
- Login and first-administrator bootstrap
- Required `X-Access-Code` support
- Rotating refresh-session restoration
- Refresh token and access code stored through platform secure storage
- In-memory access token
- Authenticated catalog loading with title, artist, album, duration, search, and pull-to-refresh
- Cross-platform `media_kit` audio engine
- JWT-authenticated HTTP range streaming without secrets in URLs
- Explicit authenticated Vault downloads streamed into private app storage, with progress, atomic completion, persistent metadata index, deletion, and local file playback
- Separate “Auf diesem Gerät” destination for Vault downloads; local-file import remains clearly marked as a future feature
- Queue from the current catalog, play/pause, seek, previous, and next controls
- Persistent miniplayer with buffering and playback-error states
- Embedded JPEG, PNG, and WebP artwork in library, recent, playlist, and player views
- Artwork fetched with access-code and JWT headers, decoded from memory, and retained in a bounded in-memory LRU cache; secrets are never placed in image URLs
- Generated initial/icon artwork fallback for missing or invalid images
- User-scoped native Brain graph with track, artist, album, genre, playlist, and favorites nodes
- Selectable Brain node details including year, release, duration, codec, favorite, and artwork metadata
- Native Settings screen available from the authenticated AppBar, with app version, account role, server endpoint, and session-local display preferences
- Admin-only Settings section with Brain Sync, automatic missing-cover lookup, progress/error counters, explicit HTTP error status/code, and direct Brain graph navigation
- Admin-only Brain Sync action in the graph view with exported counts, errors, and automatic graph reload

Non-admin accounts can inspect their role and settings but never see admin mutation controls. Display preferences are currently safe in-memory settings and reset when the app process restarts.

Automatic missing-cover lookup runs as a bounded backend job against MusicBrainz and Cover Art Archive. The app only starts and monitors it; third-party requests and cover validation never happen on the device. Background media controls, shuffle, and repeat are the next player milestones.

## Run

The production web proxy `https://vault.monopol-ai.de/api/` is the default. This keeps the native app on the same routed API path as the working browser client:

```shell
flutter run
```

Override it for local development, a direct API domain, or another deployment. Both root URLs and path-prefixed URLs are supported:

```shell
flutter run --dart-define=MMV_API_URL=http://localhost:3000
```

Android emulators normally reach a host API through `http://10.0.2.2:3000`. Plain HTTP development endpoints may require platform-specific debug network permissions; production must use HTTPS.

## Validate

```shell
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --release
```

Windows builds that use plugins require Windows Developer Mode so Flutter can create symlinks. Enable it in **Settings → System → For developers** before running or building the Windows target.

## Security

Never compile `API_ACCESS_CODE` into the app with `--dart-define`. Users enter it at login, and the native app stores it with the rotating refresh token in platform secure storage. The short-lived JWT access token remains in memory.
