import {
  Canvas,
  Children,
  FillGradient,
  FillSolid,
  Filter,
  GPUResource,
  LockAspectRatio,
  MaterialDirty,
  Name,
  Parent,
  Rect,
  Renderable,
  Selected,
  System,
  Theme,
  Transform,
  Transformable,
  Visibility,
  ZIndex,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { pendingGpuReadyDispatch } from '../API';

/**
 * Dispatches {@link Event.READY} only after the canvas entity has {@link GPUResource}
 * (async device creation in the renderer SetupDevice path).
 */
export class EmitCanvasReady extends System {
  constructor() {
    super();
    this.query(
      (q) =>
        q.using(
          Canvas,
          GPUResource,
          Theme,
          Transform,
          Renderable,
          Rect,
          Visibility,
          Name,
          LockAspectRatio,
          ZIndex,
          Filter,
          MaterialDirty,
          Parent,
          Children,
          Selected,
          Transformable,
          FillGradient,
          FillSolid,
        ).write,
    );
  }

  execute() {
    if (!pendingGpuReadyDispatch.length) {
      return;
    }
    let i = 0;
    while (i < pendingGpuReadyDispatch.length) {
      const { container, api } = pendingGpuReadyDispatch[i]!;
      if (api.getCanvas().has(GPUResource)) {
        container.dispatchEvent(new CustomEvent(Event.READY, { detail: api }));
        pendingGpuReadyDispatch.splice(i, 1);
      } else {
        i++;
      }
    }
  }
}
