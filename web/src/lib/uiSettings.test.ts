import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_UI_SETTINGS, getUiSettings, saveUiSettings } from './uiSettings';

describe('UI settings', () => {
  beforeEach(() => localStorage.clear());

  it('uses defaults for missing or invalid settings', () => {
    expect(getUiSettings()).toEqual(DEFAULT_UI_SETTINGS);
    localStorage.setItem('mmv.ui-settings', 'not-json');
    expect(getUiSettings()).toEqual(DEFAULT_UI_SETTINGS);
  });

  it('persists dense layout locally', () => {
    saveUiSettings({ denseLayout: true });
    expect(getUiSettings()).toEqual({ denseLayout: true });
  });
});
