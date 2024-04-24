import { type PluginContext, Renderer } from './plugins';
import type { Shape } from './shapes';
import { AsyncParallelHook, SyncHook, getGlobalThis } from './utils';

export interface CanvasConfig {
  canvas: HTMLCanvasElement;
  renderer?: 'webgl' | 'webgpu';
  shaderCompilerPath?: string;
  devicePixelRatio?: number;
}
export class Canvas {
  #instancePromise: Promise<this>;

  #pluginContext: PluginContext;

  #shapes: Shape[] = [];

  constructor(config: CanvasConfig) {
    const {
      canvas,
      renderer = 'webgl',
      shaderCompilerPath = '',
      devicePixelRatio,
    } = config;
    const globalThis = getGlobalThis();
    this.#pluginContext = {
      globalThis,
      canvas,
      renderer,
      shaderCompilerPath,
      devicePixelRatio: devicePixelRatio ?? globalThis.devicePixelRatio,
      hooks: {
        init: new SyncHook<[]>(),
        initAsync: new AsyncParallelHook<[]>(),
        beginFrame: new SyncHook<[]>(),
        render: new SyncHook<[Shape]>(),
        endFrame: new SyncHook<[]>(),
        destroy: new SyncHook<[]>(),
        resize: new SyncHook<[number, number]>(),
      },
    };

    this.#instancePromise = (async () => {
      const { hooks } = this.#pluginContext;
      [new Renderer()].forEach((plugin) => {
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
      hooks.render.call(shape);
    });
    hooks.endFrame.call();
  }

  resize(width: number, height: number) {
    const { hooks } = this.#pluginContext;
    hooks.resize.call(width, height);
  }

  /**
   * Destroy the canvas.
   */
  destroy() {
    const { hooks } = this.#pluginContext;
    this.#shapes.forEach((shape) => shape.destroy());
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
}
