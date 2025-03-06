/**
 * @see https://docs.rs/bevy/latest/bevy/render/struct.RenderPlugin.html
 */
// import { component } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from './';
import { PreStartUp, RenderResource } from '../systems';

export class RendererPlugin implements Plugin {
  async build(app: App) {
    // component(Mesh);
    // component(Material);

    app.addSystems(PreStartUp, RenderResource);
    // app.addSystems(PreUpdate, PrepareViewUniforms);
    // app.add_systems(Update, ExtractMeshes);
    // app.addSystems(Last, MeshPipeline);
  }
}
