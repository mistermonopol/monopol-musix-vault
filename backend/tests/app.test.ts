import { afterEach, describe, expect, it } from 'vitest';

import { buildApp, type BuildAppOptions } from '../src/app.js';
import type { DatabaseHealth } from '../src/application/database-health.js';
import type { AppConfig } from '../src/infrastructure/config.js';

const accessCode = 'test-access-code-at-least-16';

const config: AppConfig = {
  accessCode,
  artworkLookup: { batchSize: 50, enabled: true, requestIntervalMs: 1100, timeoutMs: 10000, userAgent: 'test-agent/1.0 (test@example.com)' },
  auth: {
    accessTokenMinutes: 15,
    refreshTokenDays: 30,
    secret: 'test-secret-that-is-at-least-32-characters',
  },
  database: {
    database: 'test',
    host: '127.0.0.1',
    maxConnections: 1,
    password: 'test',
    port: 5432,
    ssl: false,
    user: 'test',
  },
  HOST: '127.0.0.1',
  LIBRARY_PATH: '/music',
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
  OBSIDIAN_PATH: '/brain',
  PORT: 3000,
};

const authDependencies: Pick<
  BuildAppOptions,
  'authRepository' | 'authService' | 'artwork' | 'artworkLookup' | 'catalog' | 'devices' | 'favorites' | 'graph' | 'listening' | 'obsidianSync' | 'playlists' | 'queues' | 'scanner' | 'streaming' | 'tokenService'
> = {
  authRepository: {
    bootstrapAdmin: async () => null,
    createRefreshSession: async () => undefined,
    findUserByEmail: async () => null,
    findUserById: async () => null,
    revokeRefreshSession: async () => undefined,
    rotateRefreshSession: async () => null,
  },
  artwork: { get: async () => null },
  artworkLookup: {
    start: () => ({ attempted: 0, coversApplied: 0, errors: [], failed: 0, finishedAt: null, matched: 0, noCover: 0, noMatch: 0, queued: 0, startedAt: new Date(0).toISOString(), state: 'running', tracksUpdated: 0 }),
    status: () => ({ attempted: 0, coversApplied: 0, errors: [], failed: 0, finishedAt: null, matched: 0, noCover: 0, noMatch: 0, queued: 0, startedAt: null, state: 'idle', tracksUpdated: 0 }),
  },
  authService: {
    bootstrap: async () => {
      throw new Error('Not used');
    },
    login: async () => {
      throw new Error('Not used');
    },
    logout: async () => undefined,
    refresh: async () => {
      throw new Error('Not used');
    },
  },
  catalog: {
    execute: async () => ({ items: [], page: 1, pageSize: 50, total: 0 }),
  },
  devices: {
    list: async () => [], register: async (_userId, name, kind) => ({ createdAt: new Date(0), id: '00000000-0000-4000-8000-000000000010', kind, lastSeenAt: new Date(0), name }), revoke: async () => true,
  },
  favorites: {
    list: async () => [],
    remove: async () => undefined,
    set: async () => {
      throw new Error('Not used');
    },
  },
  graph: { get: async () => ({ edges: [], nodes: [{ id: 'track:1', label: 'Track', properties: {}, type: 'track' }] }) },
  listening: {
    addEvent: async () => ({ id: '00000000-0000-4000-8000-000000000020' }), getPosition: async () => null, listRecent: async () => [], upsertPosition: async (_userId, trackId, positionSeconds) => ({ positionSeconds, trackId, updatedAt: new Date(0) }),
  },
  obsidianSync: {
    execute: async () => ({
      counts: { albums: 0, artists: 0, genres: 0, tracks: 0 },
      errors: [],
    }),
  },
  playlists: {
    create: async (_userId, name, description) => ({ createdAt: new Date(0), description, id: '00000000-0000-4000-8000-000000000030', items: [], name, updatedAt: new Date(0) }), delete: async () => true, get: async () => null, list: async () => [], replaceItems: async () => null, update: async () => null,
  },
  queues: {
    get: async () => null, save: async (_userId, value) => ({ ...value, updatedAt: new Date(0) }), transfer: async (_userId, _source, target) => ({ currentIndex: null, deviceId: target, items: [], positionSeconds: 0, updatedAt: new Date(0) }),
  },
  scanner: {
    scan: async () => ({
      discovered: 0,
      errors: [],
      failed: 0,
      finishedAt: new Date(),
      missing: 0,
      processed: 0,
      scanId: 'test',
      startedAt: new Date(),
      status: 'completed',
      unchanged: 0,
    }),
  },
  streaming: {
    open: async () => {
      throw new Error('Not used');
    },
    resolve: async () => {
      throw new Error('Not used');
    },
  },
  tokenService: {
    createAccessToken: async () => '',
    createRefreshToken: () => ({ expiresAt: new Date(), hash: '', token: '' }),
    hashRefreshToken: () => '',
    verifyAccessToken: async () => ({ role: 'admin', userId: 'test' }),
  },
};

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

function databaseHealth(ready: boolean): DatabaseHealth {
  return {
    isReady: async () => ready,
  };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('HTTP application', () => {
  it.each(['GET', 'HEAD'] as const)('exempts %s /health from the access gate', async (method) => {
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(true),
    });
    apps.push(app);

    const response = await app.inject({ method, url: '/health' });

    expect(response.statusCode).toBe(200);
    if (method === 'GET') {
      expect(response.json()).toMatchObject({
        service: 'monopol-musix-vault-api',
        status: 'ok',
        version: '0.1.0',
      });
      expect(response.json()).toHaveProperty('timestamp');
    }
  });

  it('reports readiness when the database is available', async () => {
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(true),
    });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ready' });
  });

  it('rejects readiness when the database is unavailable', async () => {
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(false),
    });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: 'Service Unavailable',
      statusCode: 503,
    });
  });

  it.each([undefined, 'wrong-access-code'])('denies a missing or incorrect access code', async (suppliedCode) => {
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(true),
    });
    apps.push(app);

    const response = await app.inject({
      headers: suppliedCode === undefined ? {} : { 'x-access-code': suppliedCode },
      method: 'GET',
      url: '/missing',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      code: 'ACCESS_DENIED',
      error: 'Access denied',
      statusCode: 403,
    });
  });

  it('lists the authenticated user favorites with catalog data', async () => {
    const favoritedAt = new Date('2026-08-08T12:00:00.000Z');
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(true),
      favorites: {
        ...authDependencies.favorites,
        list: async (userId) => {
          expect(userId).toBe('test');
          return [{
            favoritedAt,
            track: {
              album: null,
              artists: [],
              codec: 'flac',
              durationSeconds: 180,
              genres: [],
              hasArtwork: false,
              id: '00000000-0000-4000-8000-000000000001',
              title: 'Favorite track',
              year: 2026,
            },
          }];
        },
      },
    });
    apps.push(app);

    const response = await app.inject({
      headers: {
        authorization: 'Bearer valid-token',
        'x-access-code': accessCode,
      },
      method: 'GET',
      url: '/favorites/tracks',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [{ favoritedAt: favoritedAt.toISOString(), track: { title: 'Favorite track' } }],
    });
  });

  it('validates favorite track IDs', async () => {
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(true),
    });
    apps.push(app);

    const response = await app.inject({
      headers: {
        authorization: 'Bearer valid-token',
        'x-access-code': accessCode,
      },
      method: 'PUT',
      url: '/favorites/tracks/not-a-uuid',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('returns a normalized authenticated brain graph scoped to JWT user ID', async () => {
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(true),
      graph: {
        get: async (userId) => {
          expect(userId).toBe('test');
          return { edges: [], nodes: [{ id: 'track:1', label: 'Track', properties: {}, type: 'track' }] };
        },
      },
    });
    apps.push(app);
    const response = await app.inject({ headers: { authorization: 'Bearer valid', 'x-access-code': accessCode }, method: 'GET', url: '/brain/graph' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ edges: [], nodes: [{ id: 'track:1', label: 'Track', properties: {}, type: 'track' }] });
  });

  it('serves protected artwork bytes with validated response headers', async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const app = await buildApp({
      ...authDependencies,
      artwork: { get: async () => ({ data: bytes, mimeType: 'image/jpeg' }) },
      config,
      databaseHealth: databaseHealth(true),
    });
    apps.push(app);

    const denied = await app.inject({ method: 'GET', url: '/tracks/00000000-0000-4000-8000-000000000001/artwork' });
    expect(denied.statusCode).toBe(403);

    const response = await app.inject({
      headers: { authorization: 'Bearer valid', 'x-access-code': accessCode },
      method: 'GET',
      url: '/tracks/00000000-0000-4000-8000-000000000001/artwork',
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({
      'content-length': String(bytes.length),
      'content-type': 'image/jpeg',
      'x-content-type-options': 'nosniff',
    });
    expect(response.rawPayload).toEqual(bytes);
  });

  it('returns a path-free 404 when artwork is unavailable', async () => {
    const app = await buildApp({ ...authDependencies, config, databaseHealth: databaseHealth(true) });
    apps.push(app);
    const response = await app.inject({
      headers: { authorization: 'Bearer valid', 'x-access-code': accessCode },
      method: 'GET',
      url: '/tracks/00000000-0000-4000-8000-000000000001/artwork',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'ARTWORK_NOT_FOUND', error: 'Artwork not found', statusCode: 404 });
    expect(response.body).not.toContain('/music');
  });

  it('transfers a queue without instructing playback to start', async () => {
    const app = await buildApp({ ...authDependencies, config, databaseHealth: databaseHealth(true) });
    apps.push(app);
    const response = await app.inject({ body: { sourceDeviceId: '00000000-0000-4000-8000-000000000001', targetDeviceId: '00000000-0000-4000-8000-000000000002' }, headers: { authorization: 'Bearer valid', 'x-access-code': accessCode }, method: 'POST', url: '/queue/transfer' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ autoPlay: false, queue: { deviceId: '00000000-0000-4000-8000-000000000002' } });
  });

  it('bounds queue snapshots to 500 items', async () => {
    const app = await buildApp({ ...authDependencies, config, databaseHealth: databaseHealth(true) });
    apps.push(app);
    const response = await app.inject({ body: { items: Array.from({ length: 501 }, () => '00000000-0000-4000-8000-000000000001') }, headers: { authorization: 'Bearer valid', 'x-access-code': accessCode }, method: 'PUT', url: '/queue/00000000-0000-4000-8000-000000000002' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('requires an admin role for brain sync', async () => {
    const app = await buildApp({ ...authDependencies, config, databaseHealth: databaseHealth(true), tokenService: { ...authDependencies.tokenService, verifyAccessToken: async () => ({ role: 'user', userId: 'test' }) } });
    apps.push(app);
    const response = await app.inject({ headers: { authorization: 'Bearer valid', 'x-access-code': accessCode }, method: 'POST', url: '/brain/sync' });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'ADMIN_REQUIRED' });
  });

  it('returns an actionable error when the brain mount is not writable', async () => {
    const unavailable = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(true),
      obsidianSync: { execute: async () => { throw unavailable; } },
    });
    apps.push(app);
    const response = await app.inject({
      headers: { authorization: 'Bearer valid', 'x-access-code': accessCode },
      method: 'POST',
      url: '/brain/sync',
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      code: 'OBSIDIAN_VAULT_UNAVAILABLE',
      error: 'Obsidian vault is not writable',
      statusCode: 503,
    });
  });

  it('protects artwork lookup as admin-only and exposes start/status', async () => {
    const userApp = await buildApp({ ...authDependencies, config, databaseHealth: databaseHealth(true), tokenService: { ...authDependencies.tokenService, verifyAccessToken: async () => ({ role: 'user', userId: 'test' }) } });
    apps.push(userApp);
    const headers = { authorization: 'Bearer valid', 'x-access-code': accessCode };
    expect((await userApp.inject({ headers, method: 'POST', url: '/admin/artwork/lookup' })).statusCode).toBe(403);

    const adminApp = await buildApp({ ...authDependencies, config, databaseHealth: databaseHealth(true) });
    apps.push(adminApp);
    const started = await adminApp.inject({ body: { retry: true }, headers, method: 'POST', url: '/admin/artwork/lookup' });
    expect(started.statusCode).toBe(202);
    expect(started.json()).toMatchObject({ state: 'running' });
    const status = await adminApp.inject({ headers, method: 'GET', url: '/admin/artwork/lookup' });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ state: 'idle' });
  });

  it('accepts the correct access code', async () => {
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(true),
    });
    apps.push(app);

    const response = await app.inject({
      headers: { 'x-access-code': accessCode },
      method: 'GET',
      url: '/missing',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'Not Found',
      path: '/missing',
      statusCode: 404,
    });
  });
});
