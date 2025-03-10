/**
 * @see https://docs.rs/bevy/latest/bevy/render/struct.RenderPlugin.html
 */
import { App } from '../App';
import { Plugin } from './';
import { SetupDevice, MeshPipeline, StartUp, PostUpdate } from '../systems';

export const RendererPlugin: Plugin = (app: App) => {
  app.addSystems(StartUp, SetupDevice);
  app.addSystems(PostUpdate, MeshPipeline);
};
