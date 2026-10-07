import {
  effectiveThemePreference,
  resolveThemeModeFromPreference,
  type AppState,
} from '@infinite-canvas-tutorial/ecs';
import type { LitElement } from 'lit';
import type { ExtendedAPI } from '../API';

type ThemeHost = LitElement & { api: ExtendedAPI; appState: AppState };

/** Display preferences are synchronous; they do not enter the document edit queue. */
export function updateThemePreference(host: ThemeHost, value: unknown) {
  const { api } = host;
  if (!host.isConnected || !api) return;
  let alive = true;
  const dispose = api.onDestroy(() => {
    alive = false;
  });
  try {
    if (!alive) return;
    if (value !== 'light' && value !== 'dark' && value !== 'system') return;
    const state = api.getAppState();
    const themeMode = resolveThemeModeFromPreference(value);
    if (
      effectiveThemePreference(state) === value &&
      state.themeMode === themeMode
    )
      return;
    api.setAppState({ themePreference: value, themeMode });
  } catch (error) {
    console.error('Failed to update theme preference', error);
  } finally {
    if (alive) {
      host.appState = api.getAppState();
      host.requestUpdate();
    }
    dispose();
  }
}
