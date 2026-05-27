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
 * In **unified 3D space mode**, spawn a Camera3D with `linked: true`:
 * ```ts
 * commands.spawn(new Camera3D({ linked: true, projection: 'orthographic' }));
 * ```
 * The CameraSync system will map 2D pan/zoom to the 3D camera automatically.
 *
 * 3D geometry is drawn in the first pass of {@link MeshPipeline}'s render graph;
 * 2D/grid/HTML overlays composite on the same target afterward.
 */
import { system } from '@lastolivegames/becsy';
import { Plugin, type PluginWithConfig } from './types';
import { MeshPipeline3D, CameraSync } from '../systems';
import { ComputeCamera } from '../systems';
import { PreUpdate } from '../systems/stages';

export interface Renderer3DPluginOptions {
  /**
   * Custom MeshPipeline3D system constructor override.
   */
  rendererSystemCtor?: typeof MeshPipeline3D;
}

function createRenderer3DPlugin(options: Renderer3DPluginOptions = {}): Plugin {
  return () => {
    /**
     * 3D render system (components registered in {@link DefaultRendererPlugin}).
     */
    const RenderSystem3D = options.rendererSystemCtor ?? MeshPipeline3D;
    // GPU mesh cache only; drawing runs inside MeshPipeline via appendRenderPass.
    system(PreUpdate)(RenderSystem3D);

    // CameraSync runs after ComputeCamera so it has fresh 2D camera state.
    system((s) => s.after(ComputeCamera))(CameraSync);
  };
}

export const Renderer3DPlugin: PluginWithConfig<Renderer3DPluginOptions> = {
  configure(options) {
    return createRenderer3DPlugin(options);
  },
};

export const DefaultRenderer3DPlugin = Renderer3DPlugin.configure({});
