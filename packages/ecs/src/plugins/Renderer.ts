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
} from '../systems';
import {
  Circle,
  ComputedPoints,
  ComputedRough,
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
  component(ComputedPoints);
  component(ComputedRough);

  app.addSystems(StartUp, SetupDevice);
  app.addSystems(PreUpdate, ComputePoints, ComputeRough);
  app.addSystems(PostUpdate, Sort, BatchManager, MeshPipeline);
};
