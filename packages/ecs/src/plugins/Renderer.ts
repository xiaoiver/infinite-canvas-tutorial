/**
 * @see https://docs.rs/bevy/latest/bevy/render/struct.RenderPlugin.html
 */
import { component } from '@lastolivegames/becsy';
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

  app.addSystems(StartUp, SetupDevice);
  app.addSystems(
    PreUpdate,
    ComputePoints,
    ComputeRough,
    ComputeTextMetrics,
    ComputeBounds,
  );
  app.addSystems(PostUpdate, ViewportCulling, Sort, BatchManager, MeshPipeline);
};
