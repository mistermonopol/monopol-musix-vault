import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/infrastructure/config.js';

describe('loadConfig', () => {
  it('provides safe development defaults', () => {
    expect(
      loadConfig({
        API_ACCESS_CODE: 'test-access-code-at-least-16',
        AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
        DB_PASSWORD: 'secret',
      }),
    ).toEqual({
      accessCode: 'test-access-code-at-least-16',
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
      OBSIDIAN_PATH: '/brain',
      PORT: 3000,
    });
  });

  it('requires an access code', () => {
    expect(() =>
      loadConfig({
        AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
        DB_PASSWORD: 'secret',
      }),
    ).toThrow('API_ACCESS_CODE');
  });

  it('rejects an access code shorter than 16 characters', () => {
    expect(() =>
      loadConfig({
        API_ACCESS_CODE: 'too-short',
        AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
        DB_PASSWORD: 'secret',
      }),
    ).toThrow('Too small');
  });

  it('rejects an invalid port', () => {
    expect(() =>
      loadConfig({
        API_ACCESS_CODE: 'test-access-code-at-least-16',
        AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
        DB_PASSWORD: 'secret',
        PORT: '70000',
      }),
    ).toThrow('Too big');
  });
});
