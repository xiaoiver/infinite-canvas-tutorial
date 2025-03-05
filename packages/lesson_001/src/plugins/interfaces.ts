import { CanvasConfig } from '../Canvas';
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

export type PluginContext = {
  // canvas: HTMLCanvasElement;
  // renderer: 'webgl' | 'webgpu';
  // shaderCompilerPath: string;
  /**
   * Contains the global this value.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
   */
  globalThis: typeof globalThis;
  /**
   * Returns the ratio of the resolution in physical pixels to the resolution
   * in CSS pixels for the current display device.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
   */
  // devicePixelRatio: number;
  hooks: Hooks;
} & CanvasConfig;

/**
 * Inspired by Webpack plugin system.
 */
export interface Plugin {
  /**
   * Get called when the plugin is installed.
   */
  apply: (context: PluginContext) => void;
}
