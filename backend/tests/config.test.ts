import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/infrastructure/config.js';

describe('loadConfig', () => {
  it('provides safe development defaults', () => {
    expect(loadConfig({})).toEqual({
      HOST: '0.0.0.0',
      LOG_LEVEL: 'info',
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow('Too big');
  });
});
