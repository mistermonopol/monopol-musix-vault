const STORAGE_KEY = 'mmv.ui-settings';

export interface UiSettings {
  readonly denseLayout: boolean;
}

export const DEFAULT_UI_SETTINGS: UiSettings = { denseLayout: false };

export function getUiSettings(): UiSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { denseLayout?: unknown };
    return { denseLayout: saved.denseLayout === true };
  } catch {
    return DEFAULT_UI_SETTINGS;
  }
}

export function saveUiSettings(settings: UiSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage may be unavailable */ }
}
