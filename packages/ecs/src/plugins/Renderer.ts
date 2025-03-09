/**
 * @see https://docs.rs/bevy/latest/bevy/render/struct.RenderPlugin.html
 */
import { App } from '../App';
import { Plugin } from './';
import {
  Last,
  RenderResource,
  MeshPipeline,
  PostStartup,
  GridPipeline,
} from '../systems';

export const RendererPlugin: Plugin = (app: App) => {
  app.addSystems(PostStartup, RenderResource);
  app.addSystems(Last, GridPipeline, MeshPipeline);
};
