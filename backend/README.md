# Backend

The backend is an independently deployable Fastify API written in strict TypeScript.

## Commands

```shell
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Configuration is supplied through environment variables and validated at startup. Logs are newline-delimited JSON outside the test environment.

## HTTP endpoints

- `GET /health` reports process liveness without checking external dependencies.
- `GET /ready` reports whether required dependencies are available. The skeleton has no external runtime dependency, so it currently reports ready.
