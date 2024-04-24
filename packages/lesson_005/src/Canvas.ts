import { Camera } from './Camera';
import {
  type PluginContext,
  Renderer,
  CameraControl,
  CheckboardStyle,
  GridImplementation,
} from './plugins';
import type { Shape } from './shapes';
import { AsyncParallelHook, SyncHook, getGlobalThis, traverse } from './utils';

export interface CanvasConfig {
  canvas: HTMLCanvasElement;
  renderer?: 'webgl' | 'webgpu';
  shaderCompilerPath?: string;
  devicePixelRatio?: number;
}
export class Canvas {
  #instancePromise: Promise<this>;

  #pluginContext: PluginContext;

  #rendererPlugin: Renderer;

  #shapes: Shape[] = [];

  #camera: Camera;
  get camera() {
    return this.#camera;
  }

  constructor(config: CanvasConfig) {
    const {
      canvas,
      renderer = 'webgl',
      shaderCompilerPath = '',
      devicePixelRatio,
    } = config;
    const globalThis = getGlobalThis();
    const dpr = devicePixelRatio ?? globalThis.devicePixelRatio;

    const { width, height } = canvas;
    const camera = new Camera(width / dpr, height / dpr);
    this.#camera = camera;

    this.#pluginContext = {
      globalThis,
      canvas,
      renderer,
      shaderCompilerPath,
      devicePixelRatio: dpr,
      hooks: {
        init: new SyncHook<[]>(),
        initAsync: new AsyncParallelHook<[]>(),
        beginFrame: new SyncHook<[]>(),
        render: new SyncHook<[Shape]>(),
        endFrame: new SyncHook<[]>(),
        destroy: new SyncHook<[]>(),
        resize: new SyncHook<[number, number]>(),
      },
      camera,
    };

    this.#instancePromise = (async () => {
      const { hooks } = this.#pluginContext;
      this.#rendererPlugin = new Renderer();
      [new CameraControl(), this.#rendererPlugin].forEach((plugin) => {
        plugin.apply(this.#pluginContext);
      });
      hooks.init.call();
      await hooks.initAsync.promise();
      return this;
    })();
  }

  get initialized() {
    return this.#instancePromise.then(() => this);
  }

  /**
   * Render to the canvas, usually called in a render/animate loop.
   * @example
   * const animate = () => {
      canvas.render();
      requestAnimationFrame(animate);
    };
    animate();
   */
  render() {
    const { hooks } = this.#pluginContext;
    hooks.beginFrame.call();
    this.#shapes.forEach((shape) => {
      traverse(shape, (s) => {
        hooks.render.call(s);
      });
    });
    hooks.endFrame.call();
  }

  resize(width: number, height: number) {
    const { hooks } = this.#pluginContext;
    this.#camera.projection(width, height);
    hooks.resize.call(width, height);
  }

  /**
   * Destroy the canvas.
   */
  destroy() {
    const { hooks } = this.#pluginContext;
    this.#shapes.forEach((shape) => {
      traverse(shape, (s) => {
        s.destroy();
      });
    });
    hooks.destroy.call();
  }

  getDOM() {
    return this.#pluginContext.canvas;
  }

  appendChild(shape: Shape) {
    this.#shapes.push(shape);
  }

  removeChild(shape: Shape) {
    const index = this.#shapes.indexOf(shape);
    if (index !== -1) {
      this.#shapes.splice(index, 1);
    }
  }

  setGridImplementation(implementation: GridImplementation) {
    this.#rendererPlugin.setGridImplementation(implementation);
  }

  setCheckboardStyle(style: CheckboardStyle) {
    this.#rendererPlugin.setCheckboardStyle(style);
  }
}
