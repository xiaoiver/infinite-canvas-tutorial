import { type PluginContext, Renderer } from './plugins';
import { AsyncParallelHook, SyncHook } from './utils';

export class Canvas {
  #instancePromise: Promise<this>;

  #pluginContext: PluginContext;

  constructor(config: {
    canvas: HTMLCanvasElement;
    renderer?: 'webgl' | 'webgpu';
  }) {
    const { canvas, renderer = 'webgl' } = config;
    this.#pluginContext = {
      canvas,
      renderer,
      hooks: {
        init: new SyncHook<[]>(),
        initAsync: new AsyncParallelHook<[]>(),
        beginFrame: new SyncHook<[]>(),
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
    hooks.destroy.call();
  }
}
