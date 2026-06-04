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
import { component, system } from '@lastolivegames/becsy';
import { Plugin, type PluginWithConfig } from './types';
import {
  CameraSync,
  ComputeBounds,
  EnsureExtrudeMeshes,
  MeshPipeline3D,
  SyncExtrude3D,
  Pick3D,
  RenderGizmo3D,
  Select,
} from '../systems';
import { Last, PostUpdate, PreUpdate } from '../systems/stages';

export interface Renderer3DPluginOptions {
  /**
   * Custom MeshPipeline3D system constructor override.
   */
  rendererSystemCtor?: typeof MeshPipeline3D;
}

function createRenderer3DPlugin(options: Renderer3DPluginOptions = {}): Plugin {
  return () => {
    /**
     * 3D render system (Extrude3D / Mesh3D components registered in {@link DefaultRendererPlugin}).
     */
    const RenderSystem3D = options.rendererSystemCtor ?? MeshPipeline3D;
    // GPU mesh cache only; drawing runs inside MeshPipeline via appendRenderPass.
    system(PreUpdate)(RenderSystem3D);

    // PostUpdate: mesh setup + transform/camera sync before Last render/HTML.
    // MeshPipeline tracks Transform3D/Camera3D and runs in Last after these writers.
    system(PostUpdate)(EnsureExtrudeMeshes);
    system((s) => s.after(ComputeBounds))(EnsureExtrudeMeshes);

    system(PostUpdate)(SyncExtrude3D);
    system((s) => s.after(EnsureExtrudeMeshes))(SyncExtrude3D);

    // Same-frame camera for picking; runs after Select (2D marquee probe is in Select).
    system((s) => s.after(CameraSync, Select).before(Last))(Pick3D);

    // 3D gizmo rendering: runs alongside the 3D render system.
    system(PreUpdate)(RenderGizmo3D);
  };
}

export const Renderer3DPlugin: PluginWithConfig<Renderer3DPluginOptions> = {
  configure(options) {
    return createRenderer3DPlugin(options);
  },
};

export const DefaultRenderer3DPlugin = Renderer3DPlugin.configure({});
