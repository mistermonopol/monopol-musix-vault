import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/infrastructure/config.js';

describe('loadConfig', () => {
  it('provides safe development defaults', () => {
    expect(
      loadConfig({
        AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
        DB_PASSWORD: 'secret',
      }),
    ).toEqual({
      auth: {
        accessTokenMinutes: 15,
        refreshTokenDays: 30,
        secret: 'test-secret-that-is-at-least-32-characters',
      },
      database: {
        database: 'musix_vault',
        host: '127.0.0.1',
        maxConnections: 10,
        password: 'secret',
        port: 5432,
        ssl: false,
        user: 'musix_vault',
      },
      HOST: '0.0.0.0',
      LIBRARY_PATH: '/music',
      LOG_LEVEL: 'info',
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({
            AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
            DB_PASSWORD: 'secret',
            PORT: '70000',
          })).toThrow(
      'Too big',
    );
  });
});
