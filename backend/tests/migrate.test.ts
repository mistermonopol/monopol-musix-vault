import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/infrastructure/config.js';

describe('database configuration', () => {
  it('parses PostgreSQL connection settings', () => {
    const config = loadConfig({
      DB_HOST: 'database.internal',
      DB_MAX_CONNECTIONS: '20',
      DB_NAME: 'vault',
      DB_PASSWORD: 'secret',
      DB_PORT: '5433',
      DB_SSL: 'true',
      DB_USER: 'api',
    });

    expect(config.database).toEqual({
      database: 'vault',
      host: 'database.internal',
      maxConnections: 20,
      password: 'secret',
      port: 5433,
      ssl: true,
      user: 'api',
    });
  });
});
