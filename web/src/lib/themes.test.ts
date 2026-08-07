import { describe, expect, it } from 'vitest';
import { resolveThemePath, themeForPath } from './themes';

describe('theme route resolution', () => {
  it.each(['/spotify', '/soundcloud', '/applemusic', '/amazonmusic'] as const)('accepts %s', (path) => {
    expect(resolveThemePath(path, '/spotify')).toBe(path);
    expect(themeForPath(path).path).toBe(path);
  });

  it('uses the saved route at the root or for an unknown route', () => {
    expect(resolveThemePath('/', '/applemusic')).toBe('/applemusic');
    expect(resolveThemePath('/missing', '/soundcloud')).toBe('/soundcloud');
  });

  it('defaults to spotify without a valid saved route', () => {
    expect(resolveThemePath('/', null)).toBe('/spotify');
    expect(resolveThemePath('/', '/invalid')).toBe('/spotify');
  });
});
