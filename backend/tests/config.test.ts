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
      artworkLookup: {
        batchSize: 50,
        enabled: false,
        requestIntervalMs: 1100,
        timeoutMs: 10000,
        userAgent: 'MonopolMusixVault/0.4.0 (https://vault.monopol-ai.de; derdildi@gmail.com)',
      },
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

  it('accepts artwork lookup overrides and enforces the MusicBrainz interval', () => {
    const configured = loadConfig({
      API_ACCESS_CODE: 'test-access-code-at-least-16', AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
      ARTWORK_LOOKUP_ENABLED: 'true', ARTWORK_LOOKUP_REQUEST_INTERVAL_MS: '1500',
      MUSICBRAINZ_USER_AGENT: 'Vault/1.0 (admin@example.com)', DB_PASSWORD: 'secret',
    });
    expect(configured.artworkLookup).toMatchObject({ enabled: true, requestIntervalMs: 1500, userAgent: 'Vault/1.0 (admin@example.com)' });
    expect(() => loadConfig({ API_ACCESS_CODE: 'test-access-code-at-least-16', AUTH_SECRET: 'test-secret-that-is-at-least-32-characters', ARTWORK_LOOKUP_REQUEST_INTERVAL_MS: '1000', DB_PASSWORD: 'secret' })).toThrow('Too small');
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
