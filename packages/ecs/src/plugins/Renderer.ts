/**
 * @see https://docs.rs/bevy/latest/bevy/render/struct.RenderPlugin.html
 */
import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  SetupDevice,
  MeshPipeline,
  Sort,
  ComputePoints,
  ComputeRough,
  ComputeTextMetrics,
  ComputeBounds,
  SetCursor,
  PreUpdate,
  PostUpdate,
  ComputeCamera,
  StartUp,
  Deleter,
  Last,
  PropagateTransforms,
  CameraControl,
  Select,
  ExportSVG,
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
  Visibility,
  GPUResource,
  Name,
  ToBeDeleted,
} from '../components';

export const RendererPlugin: Plugin = () => {
  /**
   * Components
   */
  component(GPUResource);
  component(Renderable);
  component(Name);
  component(Wireframe);
  component(GlobalRenderOrder);
  component(Visibility);
  component(ToBeDeleted);
  /**
   * Style
   */
  component(FillSolid);
  component(FillGradient);
  component(FillPattern);
  component(FillImage);
  component(FillTexture);
  component(Stroke);
  component(Opacity);
  component(DropShadow);
  component(InnerShadow);
  component(Rough);

  /**
   * Geometry
   */
  component(Circle);
  component(Ellipse);
  component(Rect);
  component(Polyline);
  component(Path);
  component(Text);
  component(ComputedPoints);
  component(ComputedRough);
  component(ComputedTextMetrics);
  component(ComputedBounds);

  system(StartUp)(SetupDevice);
  system(PreUpdate)(ComputePoints);
  system(PreUpdate)(ComputeRough);
  system(PreUpdate)(ComputeTextMetrics);
  system(PostUpdate)(ComputeBounds);
  system((s) => s.after(PropagateTransforms))(ComputeBounds);
  system(PostUpdate)(Sort);
  system(PostUpdate)(SetCursor);
  system((s) => s.after(ComputeCamera, SetupDevice))(MeshPipeline);
  system((s) =>
    s.after(
      Last,
      PropagateTransforms,
      CameraControl,
      // Select,
      ComputeCamera,
      MeshPipeline,
      ExportSVG,
    ),
  )(Deleter);
};
