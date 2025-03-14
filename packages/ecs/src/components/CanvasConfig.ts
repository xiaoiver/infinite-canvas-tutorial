import { field, component, Type } from '@lastolivegames/becsy';

export enum CanvasMode {
  SELECT = 'select',
  HAND = 'hand',
  DRAW_RECT = 'draw-rect',
}

@component
export class CanvasConfig {
  /**
   * The canvas element. Pass in HTMLCanvasElement in the browser environment, OffscreenCanvas in the WebWorker environment,
   * and node-canvas in the Node.js environment.
   */
  @field.object declare canvas: HTMLCanvasElement | OffscreenCanvas;

  /**
   * The width of the canvas.
   */
  @field({ type: Type.float32, default: 0 }) declare width: number;

  /**
   * The height of the canvas.
   */
  @field({ type: Type.float32, default: 0 }) declare height: number;

  /**
   * Set the renderer, optional values are webgl and webgpu, default value is webgl.
   */
  @field({ type: Type.staticString(['webgl', 'webgpu']), default: 'webgl' })
  declare renderer: 'webgl' | 'webgpu';

  /**
   * Set the WebGPU shader compiler path.
   */
  @field.object declare shaderCompilerPath: string;

  /**
   * Returns the ratio of the resolution in physical pixels to the resolution
   * in CSS pixels for the current display device.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
   */
  @field({ type: Type.float32, default: 1 }) declare devicePixelRatio: number;

  /**
   * Default to `CanvasMode.HAND`.
   */
  @field({
    type: Type.staticString([
      CanvasMode.SELECT,
      CanvasMode.HAND,
      CanvasMode.DRAW_RECT,
    ]),
    default: CanvasMode.HAND,
  })
  declare mode: CanvasMode;
}
