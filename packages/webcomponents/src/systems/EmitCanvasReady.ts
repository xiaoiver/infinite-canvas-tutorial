import {
  Canvas,
  Children,
  FillLayers,
  FillTexture,
  FillTextureLive,
  Filter,
  GPUResource,
  VelloCanvasSurface,
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
  Flex,
  ComputedCamera,
  Grid,
  Ellipse,
  Line,
  Polyline,
  Path,
  Text,
  Opacity,
  StrokeLayers,
  Stroke,
  Group,
  ClipMode,
  Brush,
  VectorNetwork,
  Locked,
  Marker,
  Binded,
  Binding,
  PartialBinding,
  AnimationPlayer,
  Embed,
  HTML,
  HTMLContainer,
  Rough,
  Camera3D,
  Transform3D,
  Material3D,
  Mesh3D,
  Extrude3D,
  Light3D,
  Mesh3DNode,
  NodeLayerBlendMode,
  DropShadow,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { pendingGpuReadyDispatch } from '../API';

/**
 * Dispatches {@link Event.READY} after the canvas has {@link GPUResource} (Mesh / SetupDevice)
 * or {@link VelloCanvasSurface}（纯 Vello 路径无 ECS GPUResource）。
 */
export class EmitCanvasReady extends System {
  constructor() {
    super();
    this.query(
      (q) =>
        q.using(
          Canvas,
          ComputedCamera,
          Grid,
          GPUResource,
          VelloCanvasSurface,
          Theme,
          Transform,
          Renderable,
          Rect,
          Ellipse,
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
          FillLayers,
          FillTexture,
          FillTextureLive,
          Flex,
          Line,
          Polyline,
          Path,
          Text,
          Group,
          Opacity,
          Stroke,
          StrokeLayers,
          ClipMode,
          Brush,
          VectorNetwork,
          Locked,
          Marker,
          Binded,
          Binding,
          PartialBinding,
          AnimationPlayer,
          Embed,
          HTML,
          HTMLContainer,
          Rough,
          Camera3D,
          Mesh3D,
          Material3D,
          Transform3D,
          Extrude3D,
          Light3D,
          Mesh3DNode,
          NodeLayerBlendMode,
          DropShadow,
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
      if (
        api.getCanvas().has(GPUResource) ||
        api.getCanvas().has(VelloCanvasSurface)
      ) {
        container.dispatchEvent(new CustomEvent(Event.READY, { detail: api }));
        pendingGpuReadyDispatch.splice(i, 1);
      } else {
        i++;
      }
    }
  }
}
