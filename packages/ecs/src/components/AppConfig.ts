import { trait } from 'koota';

export enum CanvasMode {
  SELECT = 'select',
  HAND = 'hand',
  DRAW_RECT = 'draw-rect',
}

export enum CheckboardStyle {
  NONE = 'none',
  GRID = 'grid',
  DOTS = 'dots',
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
}

interface ThemeColors {
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
}

export interface CanvasConfig {
  /**
   * The canvas element. Pass in HTMLCanvasElement in the browser environment, OffscreenCanvas in the WebWorker environment,
   * and node-canvas in the Node.js environment.
   */
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /**
   * Set the renderer, optional values are webgl and webgpu, default value is webgl.
   */
  renderer?: 'webgl' | 'webgpu';
  /**
   * Set the WebGPU shader compiler path.
   */
  shaderCompilerPath?: string;
  /**
   * Returns the ratio of the resolution in physical pixels to the resolution
   * in CSS pixels for the current display device.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
   */
  devicePixelRatio?: number;
  /**
   * Checkboard style.
   */
  checkboardStyle?: CheckboardStyle;
  /**
   * Default to `CanvasMode.HAND`.
   */
  mode?: CanvasMode;
  /**
   * Theme.
   */
  theme?: Theme;
  /**
   * Theme colors.
   * @see https://github.com/dgmjs/dgmjs/blob/main/packages/core/src/colors.ts#L130
   */
  themeColors?: Partial<{
    [Theme.LIGHT]: Partial<ThemeColors>;
    [Theme.DARK]: Partial<ThemeColors>;
  }>;
}

export const DEFAULT_APP_CONFIG: CanvasConfig = {
  canvas: undefined,
  renderer: 'webgl',
  shaderCompilerPath: '',
  devicePixelRatio: 1,
  mode: CanvasMode.HAND,
  checkboardStyle: CheckboardStyle.GRID,
  theme: Theme.LIGHT,
  themeColors: {
    [Theme.LIGHT]: {
      background: '#fbfbfb',
      grid: '#dedede',
      selectionBrushFill: '#dedede',
      selectionBrushStroke: '#dedede',
    },
    [Theme.DARK]: {
      background: '#121212',
      grid: '#242424',
      selectionBrushFill: '#242424',
      selectionBrushStroke: '#242424',
    },
  },
};

// @ts-expect-error
export const AppConfig = trait<CanvasConfig>(DEFAULT_APP_CONFIG);
