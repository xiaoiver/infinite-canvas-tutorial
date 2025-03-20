import { Entity, field, Type } from '@lastolivegames/becsy';

export enum Pen {
  SELECT = 'select',
  HAND = 'hand',
  DRAW_RECT = 'draw-rect',
}

export class Canvas {
  /**
   * The canvas element. Pass in HTMLCanvasElement in the browser environment, OffscreenCanvas in the WebWorker environment,
   * and node-canvas in the Node.js environment.
   */
  @field.object declare element: HTMLCanvasElement | OffscreenCanvas;

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
   * Default to `Pen.HAND`.
   */
  @field({
    type: Type.staticString([Pen.SELECT, Pen.HAND, Pen.DRAW_RECT]),
    default: Pen.HAND,
  })
  declare pen: Pen;

  /**
   * TODO: multiple {@link Camera}s
   * @example
   *
   * camera1.write(Camera).target = canvas;
   * camera2.write(Camera).target = canvas;
   */
  @field.backrefs declare cameras: Entity[];

  constructor(canvas?: Partial<Canvas>) {
    Object.assign(this, canvas);
  }
}
