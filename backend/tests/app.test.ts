import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import type { DatabaseHealth } from '../src/application/database-health.js';
import type { AppConfig } from '../src/infrastructure/config.js';

const config: AppConfig = {
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
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
  PORT: 3000,
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
    const app = await buildApp({ config, databaseHealth: databaseHealth(true) });
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
    const app = await buildApp({ config, databaseHealth: databaseHealth(true) });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ready' });
  });

  it('rejects readiness when the database is unavailable', async () => {
    const app = await buildApp({ config, databaseHealth: databaseHealth(false) });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: 'Service Unavailable',
      statusCode: 503,
    });
  });

  it('returns a structured not-found response', async () => {
    const app = await buildApp({ config, databaseHealth: databaseHealth(true) });
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
