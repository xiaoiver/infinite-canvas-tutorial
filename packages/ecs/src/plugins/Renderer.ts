/**
 * @see https://docs.rs/bevy/latest/bevy/render/struct.RenderPlugin.html
 */
import { component, system } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from './';
import {
  SetupDevice,
  MeshPipeline,
  StartUp,
  PostUpdate,
  BatchManager,
  Sort,
  PreUpdate,
  ComputePoints,
  ComputeRough,
  ComputeTextMetrics,
  ViewportCulling,
  ComputeBounds,
  Last,
  ComputeCamera,
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
} from '../components';

export const RendererPlugin: Plugin = (app: App) => {
  component(Renderable);
  component(Wireframe);
  component(GlobalRenderOrder);
  component(ZIndex);

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
  system(PreUpdate)(ComputeBounds);

  system(PostUpdate)(Sort);
  system(PostUpdate)(BatchManager);
  system(PostUpdate)(SetCursor);

  system((s) => s.after(ComputeCamera, SetupDevice, BatchManager))(
    MeshPipeline,
  );
};
