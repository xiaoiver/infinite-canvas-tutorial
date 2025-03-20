/**
 * @see https://docs.rs/bevy/latest/bevy/render/struct.RenderPlugin.html
 */
import { Plugin } from './';
import {
  SetupDevice,
  MeshPipeline,
  BatchManager,
  Sort,
  ComputePoints,
  ComputeRough,
  ComputeTextMetrics,
  ComputeBounds,
  SetCursor,
} from '../systems';
import {
  Circle,
  ComputedBounds,
  ComputedPoints,
  ComputedRough,
  ComputedTextMetrics,
  DropShadow,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  GlobalRenderOrder,
  InnerShadow,
  Opacity,
  Path,
  Polyline,
  Rect,
  Renderable,
  Rough,
  Stroke,
  Text,
  Wireframe,
  ZIndex,
  Visibility,
  GPUResource,
} from '../components';

export const RendererPlugin: Plugin = () => {
  return [
    /**
     * Systems
     */
    SetupDevice,
    ComputePoints,
    ComputeRough,
    ComputeTextMetrics,
    ComputeBounds,
    Sort,
    BatchManager,
    SetCursor,
    MeshPipeline,

    /**
     * Components
     */
    GPUResource,
    Renderable,
    Wireframe,
    GlobalRenderOrder,
    ZIndex,
    Visibility,
    /**
     * Style
     */
    FillSolid,
    FillGradient,
    FillPattern,
    FillImage,
    FillTexture,
    Stroke,
    Opacity,
    DropShadow,
    InnerShadow,
    Rough,

    /**
     * Geometry
     */
    Circle,
    Ellipse,
    Rect,
    Polyline,
    Path,
    Text,
    ComputedPoints,
    ComputedRough,
    ComputedTextMetrics,
    ComputedBounds,
  ];
};
