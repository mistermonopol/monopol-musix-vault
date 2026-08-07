# Monopol Musix Vault Flutter client

Native mobile and desktop client for Android, iOS, Windows, macOS, and Linux. The React application remains the browser client.

## Current milestone

- Material 3 application shell
- Configurable direct API endpoint
- Login and first-administrator bootstrap
- Required `X-Access-Code` support
- Rotating refresh-session restoration
- Refresh token and access code stored through platform secure storage
- In-memory access token
- Authenticated catalog loading with title, artist, album, duration, search, and pull-to-refresh
- Cross-platform `media_kit` audio engine
- JWT-authenticated HTTP range streaming without secrets in URLs
- Queue from the current catalog, play/pause, seek, previous, and next controls
- Persistent miniplayer with buffering and playback-error states

Artwork, background media controls, shuffle, and repeat are the next player milestones.

## Run

The production API is the default:

```shell
flutter run
```

Override it for local development or another deployment:

```shell
flutter run --dart-define=MMV_API_URL=http://localhost:3000
```

Android emulators normally reach a host API through `http://10.0.2.2:3000`. Plain HTTP development endpoints may require platform-specific debug network permissions; production must use HTTPS.

## Validate

```shell
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
```

Windows builds that use plugins require Windows Developer Mode so Flutter can create symlinks. Enable it in **Settings → System → For developers** before running or building the Windows target.

## Security

Never compile `API_ACCESS_CODE` into the app with `--dart-define`. Users enter it at login, and the native app stores it with the rotating refresh token in platform secure storage. The short-lived JWT access token remains in memory.
