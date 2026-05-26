/**
 * 3D Rendering Plugin.
 * Similar to Bevy's Core3dPlugin, this plugin registers 3D components
 * and the MeshPipeline3D system.
 *
 * @see https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html
 *
 * Usage:
 * ```ts
 * new App()
 *   .addPlugins(
 *     DefaultRendererPlugin, // existing 2D pipeline
 *     Renderer3DPlugin.configure({}), // new 3D pipeline
 *   )
 * ```
 *
 * The 3D pipeline renders before the 2D pipeline (Camera3D.order = -1),
 * so 2D UI/overlays can be drawn on top of the 3D scene.
 */
import { component, system } from '@lastolivegames/becsy';
import { Plugin, type PluginWithConfig } from './types';
import { Camera3D, Mesh3D, Material3D, Transform3D } from '../components';
import { MeshPipeline3D } from '../systems/MeshPipeline3D';
import { Last } from '../systems/stages';

export interface Renderer3DPluginOptions {
  /**
   * Custom MeshPipeline3D system constructor override.
   */
  rendererSystemCtor?: typeof MeshPipeline3D;
}

function createRenderer3DPlugin(options: Renderer3DPluginOptions = {}): Plugin {
  return () => {
    /**
     * 3D Components
     */
    component(Camera3D);
    component(Mesh3D);
    component(Material3D);
    component(Transform3D);

    /**
     * 3D Render System
     */
    const RenderSystem3D = options.rendererSystemCtor ?? MeshPipeline3D;
    system(Last)(RenderSystem3D);
  };
}

export const Renderer3DPlugin: PluginWithConfig<Renderer3DPluginOptions> = {
  configure(options) {
    return createRenderer3DPlugin(options);
  },
};

export const DefaultRenderer3DPlugin = Renderer3DPlugin.configure({});
