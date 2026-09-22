import { field, Type } from '@lastolivegames/becsy';
import { TRANSFORMER_ANCHOR_STROKE_COLOR, TRANSFORMER_MASK_FILL_COLOR } from '../systems/RenderTransformer';

export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
}

/** 用户主题偏好；{@link ThemeMode} 为当前画布/面板实际生效模式 */
export type ThemePreference = 'light' | 'dark' | 'system';

export function resolveThemeModeFromPreference(
  pref: ThemePreference,
): ThemeMode {
  if (pref === 'light') {
    return ThemeMode.LIGHT;
  }
  if (pref === 'dark') {
    return ThemeMode.DARK;
  }
  if (
    typeof globalThis === 'undefined' ||
    typeof (globalThis as Window & typeof globalThis).matchMedia !==
      'function'
  ) {
    return ThemeMode.LIGHT;
  }
  return (globalThis as Window & typeof globalThis)
    .matchMedia('(prefers-color-scheme: dark)')
    .matches
    ? ThemeMode.DARK
    : ThemeMode.LIGHT;
}

/** 无 `themePreference` 的旧状态：由 `themeMode` 反推菜单选中项 */
export function effectiveThemePreference(state: {
  themePreference?: ThemePreference;
  themeMode: ThemeMode;
}): ThemePreference {
  if (state.themePreference != null) {
    return state.themePreference;
  }
  return state.themeMode === ThemeMode.DARK ? 'dark' : 'light';
}

export interface ThemeColors {
  /**
   * Background color of page.
   */
  background: string;
  /**
   * Color of grid.
   */
  grid: string;
  /**
   * Fill color of the selection brush.
   */
  selectionBrushFill: string;
  /**
   * Stroke color of the selection brush.
   */
  selectionBrushStroke: string;

  /**
   * Swatches.
   */
  swatches: string[];
}

/**
 * Default palette per mode (canvas background, grid, selection chrome).
 * @see https://github.com/dgmjs/dgmjs/blob/main/packages/core/src/colors.ts#L130
 */
export const DEFAULT_THEME_COLORS: Record<ThemeMode, ThemeColors> = {
  [ThemeMode.LIGHT]: {
    background: '#fbfbfb',
    grid: '#dedede',
    selectionBrushFill: TRANSFORMER_MASK_FILL_COLOR,
    selectionBrushStroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
    swatches: [],
  },
  [ThemeMode.DARK]: {
    background: '#121212',
    grid: '#242424',
    selectionBrushFill: TRANSFORMER_MASK_FILL_COLOR,
    selectionBrushStroke: TRANSFORMER_ANCHOR_STROKE_COLOR,
    swatches: [],
  },
};

export type ThemeStateLike = {
  mode: ThemeMode;
  colors: Partial<{
    [ThemeMode.LIGHT]: Partial<ThemeColors>;
    [ThemeMode.DARK]: Partial<ThemeColors>;
  }>;
};

/**
 * Merge partial theme updates with defaults and previous state (AppState / undo-safe).
 */
export function mergeThemeState(
  base: ThemeStateLike,
  patch: Partial<ThemeStateLike> | undefined,
): { mode: ThemeMode; colors: Record<ThemeMode, ThemeColors> } {
  if (!patch) {
    return {
      mode: base.mode,
      colors: {
        [ThemeMode.LIGHT]: {
          ...DEFAULT_THEME_COLORS[ThemeMode.LIGHT],
          ...base.colors?.[ThemeMode.LIGHT],
        },
        [ThemeMode.DARK]: {
          ...DEFAULT_THEME_COLORS[ThemeMode.DARK],
          ...base.colors?.[ThemeMode.DARK],
        },
      },
    };
  }
  return {
    mode: patch.mode ?? base.mode,
    colors: {
      [ThemeMode.LIGHT]: {
        ...DEFAULT_THEME_COLORS[ThemeMode.LIGHT],
        ...base.colors?.[ThemeMode.LIGHT],
        ...patch.colors?.[ThemeMode.LIGHT],
      },
      [ThemeMode.DARK]: {
        ...DEFAULT_THEME_COLORS[ThemeMode.DARK],
        ...base.colors?.[ThemeMode.DARK],
        ...patch.colors?.[ThemeMode.DARK],
      },
    },
  };
}

export class Theme {
  /**
   * Theme.
   */
  @field({
    type: Type.staticString([ThemeMode.LIGHT, ThemeMode.DARK]),
    default: ThemeMode.LIGHT,
  })
  declare mode: ThemeMode;

  /**
   * Theme colors.
   * @see https://github.com/dgmjs/dgmjs/blob/main/packages/core/src/colors.ts#L130
   */
  @field({
    type: Type.object,
    default: {
      [ThemeMode.LIGHT]: { ...DEFAULT_THEME_COLORS[ThemeMode.LIGHT] },
      [ThemeMode.DARK]: { ...DEFAULT_THEME_COLORS[ThemeMode.DARK] },
    },
  })
  declare colors: Partial<{
    [ThemeMode.LIGHT]: Partial<ThemeColors>;
    [ThemeMode.DARK]: Partial<ThemeColors>;
  }>;
}
