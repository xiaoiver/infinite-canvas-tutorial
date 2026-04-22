import {
  type AppState,
  type ThemePreference,
  resolveThemeModeFromPreference,
} from '@infinite-canvas-tutorial/ecs';

const STORAGE_KEY = 'ic-theme-preference';

export function readStoredThemePreference(): Partial<
  Pick<AppState, 'themePreference' | 'themeMode'>
> {
  if (typeof localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as { themePreference?: ThemePreference };
    const pref = parsed.themePreference;
    if (
      pref !== 'light' &&
      pref !== 'dark' &&
      pref !== 'system'
    ) {
      return {};
    }
    return {
      themePreference: pref,
      themeMode: resolveThemeModeFromPreference(pref),
    };
  } catch {
    return {};
  }
}

export function persistThemePreference(pref: ThemePreference): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themePreference: pref }));
  } catch {
    /* ignore quota */
  }
}
