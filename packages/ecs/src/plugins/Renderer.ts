/**
 * @see https://docs.rs/bevy/latest/bevy/render/struct.RenderPlugin.html
 */
// import { component } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from './';
import { PreStartUp, Last, RenderResource, MeshPipeline } from '../systems';

export const RendererPlugin: Plugin = (app: App) => {
  app.addSystems(PreStartUp, RenderResource);
  app.addSystems(Last, MeshPipeline);
};
