import { field, component } from '@lastolivegames/becsy';

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

@component
export class AppConfig {
  /**
   * The canvas element. Pass in HTMLCanvasElement in the browser environment, OffscreenCanvas in the WebWorker environment,
   * and node-canvas in the Node.js environment.
   */
  @field.object declare canvas: HTMLCanvasElement | OffscreenCanvas;
  /**
   * Set the renderer, optional values are webgl and webgpu, default value is webgl.
   */
  @field.staticString(['webgl', 'webgpu']) declare renderer: 'webgl' | 'webgpu';
  /**
   * Set the WebGPU shader compiler path.
   */
  @field.object declare shaderCompilerPath: string;
  /**
   * Returns the ratio of the resolution in physical pixels to the resolution
   * in CSS pixels for the current display device.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
   */
  @field.float32 declare devicePixelRatio: number;
  /**
   * Checkboard style.
   */
  @field.staticString([
    CheckboardStyle.NONE,
    CheckboardStyle.GRID,
    CheckboardStyle.DOTS,
  ])
  declare checkboardStyle: CheckboardStyle;
  /**
   * Default to `CanvasMode.HAND`.
   */
  @field.staticString([
    CanvasMode.SELECT,
    CanvasMode.HAND,
    CanvasMode.DRAW_RECT,
  ])
  declare mode: CanvasMode;
  /**
   * Theme.
   */
  @field.staticString([Theme.LIGHT, Theme.DARK]) declare theme: Theme;
  /**
   * Theme colors.
   * @see https://github.com/dgmjs/dgmjs/blob/main/packages/core/src/colors.ts#L130
   */
  @field.object declare themeColors: Partial<{
    [Theme.LIGHT]: Partial<ThemeColors>;
    [Theme.DARK]: Partial<ThemeColors>;
  }>;
}
