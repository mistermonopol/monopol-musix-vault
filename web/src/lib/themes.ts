export const THEME_PATHS = ['/spotify', '/soundcloud', '/applemusic', '/amazonmusic'] as const;

export type ThemePath = typeof THEME_PATHS[number];
export type ThemeId = ThemePath extends `/${infer Id}` ? Id : never;

export interface ThemeDefinition {
  readonly id: ThemeId;
  readonly path: ThemePath;
  readonly label: string;
  readonly kicker: string;
}

export const THEMES: readonly ThemeDefinition[] = [
  { id: 'spotify', path: '/spotify', label: 'Spotify inspired', kicker: 'Made for your vault' },
  { id: 'soundcloud', path: '/soundcloud', label: 'SoundCloud inspired', kicker: 'Discover your collection' },
  { id: 'applemusic', path: '/applemusic', label: 'Apple Music inspired', kicker: 'New in your library' },
  { id: 'amazonmusic', path: '/amazonmusic', label: 'Amazon Music inspired', kicker: 'Listen your way' },
];

const STORAGE_KEY = 'mmv.ui-design';

export function isThemePath(pathname: string): pathname is ThemePath {
  return THEME_PATHS.includes(pathname as ThemePath);
}

export function resolveThemePath(pathname: string, savedPath: string | null): ThemePath {
  if (isThemePath(pathname)) return pathname;
  return isThemePath(savedPath ?? '') ? savedPath as ThemePath : '/spotify';
}

export function getSavedThemePath(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function saveThemePath(path: ThemePath): void {
  try { localStorage.setItem(STORAGE_KEY, path); } catch { /* storage may be unavailable */ }
}

export function themeForPath(path: ThemePath): ThemeDefinition {
  const theme = THEMES.find((candidate) => candidate.path === path);
  if (theme === undefined) throw new Error(`Unknown UI design route: ${path}`);
  return theme;
}
