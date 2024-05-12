import type RBush from 'rbush';
import type { IPointData } from '@pixi/math';
import { Camera } from '../Camera';
import { type Group, Shape, RBushNodeAABB } from '../shapes';
import { AsyncParallelHook, SyncHook, SyncWaterfallHook } from '../utils';
import type { InteractivePointerEvent } from './DOMEventListener';

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

  render: SyncHook<[Shape]>;
  /**
   * Called at the destruction stage.
   */
  destroy: SyncHook<[]>;
  /**
   * Called when the canvas is resized.
   */
  resize: SyncHook<[number, number]>;
  pointerDown: SyncHook<[InteractivePointerEvent]>;
  pointerUp: SyncHook<[InteractivePointerEvent]>;
  pointerMove: SyncHook<[InteractivePointerEvent]>;
  pointerOut: SyncHook<[InteractivePointerEvent]>;
  pointerOver: SyncHook<[InteractivePointerEvent]>;
  pointerWheel: SyncHook<[InteractivePointerEvent]>;
  pointerCancel: SyncHook<[InteractivePointerEvent]>;
  pickSync: SyncWaterfallHook<[PickingResult], PickingResult>;
  cameraChange: SyncHook<[]>;
}

export interface PickingResult {
  /**
   * position in canvas coordinate
   */
  position: IPointData;
  picked: Shape[];
  /**
   * only return the topmost object if there are multiple objects overlapped
   */
  topmost?: boolean;
}

export interface PluginContext {
  canvas: HTMLCanvasElement;
  renderer: 'webgl' | 'webgpu';
  shaderCompilerPath: string;
  /**
   * Contains the global this value.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis
   */
  globalThis: typeof globalThis;
  /**
   * Does the device support pointer events
   * @see https://www.w3.org/Submission/pointer-events/
   */
  supportsPointerEvents: boolean;
  /**
   * Does the device support touch events
   * @see https://www.w3.org/TR/touch-events/
   */
  supportsTouchEvents: boolean;
  /**
   * Returns the ratio of the resolution in physical pixels to the resolution
   * in CSS pixels for the current display device.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
   */
  devicePixelRatio: number;
  hooks: Hooks;
  camera: Camera;
  root: Group;
  rBushRoot: RBush<RBushNodeAABB>;
  api: {
    elementsFromPoint(x: number, y: number): Shape[];
    elementFromPoint(x: number, y: number): Shape;
    elementsFromBBox(
      minX: number,
      minY: number,
      maxX: number,
      maxY: number,
    ): Shape[];
    client2Viewport({ x, y }: IPointData): IPointData;
    viewport2Client({ x, y }: IPointData): IPointData;
    viewport2Canvas({ x, y }: IPointData): IPointData;
    canvas2Viewport({ x, y }: IPointData): IPointData;
  };
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
