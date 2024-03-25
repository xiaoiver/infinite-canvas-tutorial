import { AsyncParallelHook, SyncHook } from '../utils';

export interface Hooks {
  /**
   * Called at the initialization stage.
   */
  init: SyncHook<[]>;
  /**
   * Called at the initialization stage.
   */
  initAsync: AsyncParallelHook<[]>;
  /**
   * Called at the beginning of each frame.
   */
  beginFrame: SyncHook<[]>;
  /**
   * Called at the end of each frame.
   */
  endFrame: SyncHook<[]>;
  /**
   * Called at the destruction stage.
   */
  destroy: SyncHook<[]>;
  /**
   * Called when the canvas is resized.
   */
  resize: SyncHook<[number, number]>;
}

export interface PluginContext {
  canvas: HTMLCanvasElement;
  renderer: 'webgl' | 'webgpu';
  hooks: Hooks;
}

/**
 * Inspired by Webpack plugin system.
 */
export interface Plugin {
  /**
   * Get called when the plugin is installed.
   */
  apply: (context: PluginContext) => void;
}
