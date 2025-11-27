import { Entity, field, Type } from '@lastolivegames/becsy';
import { Camera } from './camera';
import { InputPoint } from './Input';
import { Font } from './Font';
import { API } from '../API';

export enum Pen {
  SELECT = 'select',
  HAND = 'hand',
  DRAW_RECT = 'draw-rect',
  DRAW_ELLIPSE = 'draw-ellipse',
  DRAW_LINE = 'draw-line',
  DRAW_ARROW = 'draw-arrow',
  DRAW_ROUGH_RECT = 'draw-rough-rect',
  DRAW_ROUGH_ELLIPSE = 'draw-rough-ellipse',
  IMAGE = 'image',
  TEXT = 'text',
  PENCIL = 'pencil',
  BRUSH = 'brush',
  VECTOR_NETWORK = 'vector-network',
  COMMENT = 'comment',
}

export class Canvas {
  /**
   * The canvas element. Pass in HTMLCanvasElement in the browser environment, OffscreenCanvas in the WebWorker environment,
   * and node-canvas in the Node.js environment.
   */
  @field.object declare element: HTMLCanvasElement | OffscreenCanvas;

  /**
   * The HTML layer element.
   */
  @field.object declare htmlLayer: HTMLDivElement;

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
   * TODO: multiple {@link Camera}s
   * @example
   *
   * camera1.write(Camera).canvas = canvas;
   * camera2.write(Camera).canvas = canvas;
   */
  @field.backrefs(Camera, 'canvas') declare cameras: Entity[];

  @field.backrefs(InputPoint, 'canvas') declare inputPoints: Entity[];

  @field.backrefs(Font, 'canvas') declare fonts: Entity[];

  @field.object declare api: API;

  constructor(canvas?: Partial<Canvas>) {
    Object.assign(this, canvas);
  }
}
