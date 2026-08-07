import { describe, expect, it } from 'vitest';

import { GetHealth, type Clock } from '../src/application/get-health.js';

class FixedClock implements Clock {
  public now(): Date {
    return new Date('2026-01-02T03:04:05.000Z');
  }
}

describe('GetHealth', () => {
  it('returns a deterministic service report', () => {
    const getHealth = new GetHealth(new FixedClock(), '1.2.3');

    expect(getHealth.execute('ok')).toEqual({
      service: 'monopol-musix-vault-api',
      status: 'ok',
      timestamp: '2026-01-02T03:04:05.000Z',
      version: '1.2.3',
    });
  });
});
