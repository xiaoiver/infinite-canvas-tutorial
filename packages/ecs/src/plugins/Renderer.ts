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
} from '../systems';
import {
  Circle,
  DropShadow,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  InnerShadow,
  Opacity,
  Renderable,
  Stroke,
} from '../components';

export const RendererPlugin: Plugin = (app: App) => {
  component(Renderable);

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

  /**
   * Geometry
   */
  component(Circle);

  app.addSystems(StartUp, SetupDevice);
  app.addSystems(PostUpdate, BatchManager, MeshPipeline);
};
