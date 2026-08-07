import { afterEach, describe, expect, it } from 'vitest';

import { buildApp, type BuildAppOptions } from '../src/app.js';
import type { DatabaseHealth } from '../src/application/database-health.js';
import type { AppConfig } from '../src/infrastructure/config.js';

const config: AppConfig = {
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
  PORT: 3000,
};

const authDependencies: Pick<
  BuildAppOptions,
  'authRepository' | 'authService' | 'scanner' | 'streaming' | 'tokenService'
> = {
  authRepository: {
    bootstrapAdmin: async () => null,
    createRefreshSession: async () => undefined,
    findUserByEmail: async () => null,
    findUserById: async () => null,
    revokeRefreshSession: async () => undefined,
    rotateRefreshSession: async () => null,
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
  it('reports process health', async () => {
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(true),
    });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: 'monopol-musix-vault-api',
      status: 'ok',
      version: '0.1.0',
    });
    expect(response.json()).toHaveProperty('timestamp');
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

  it('returns a structured not-found response', async () => {
    const app = await buildApp({
      ...authDependencies,
      config,
      databaseHealth: databaseHealth(true),
    });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/missing' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: 'Not Found',
      path: '/missing',
      statusCode: 404,
    });
  });
});
