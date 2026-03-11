/**
 * @see https://docs.rs/bevy/latest/bevy/render/struct.RenderPlugin.html
 */
import { component, system, SystemType } from '@lastolivegames/becsy';
import { Plugin, type PluginWithConfig } from './types';
import {
  SetupDevice,
  MeshPipeline,
  Sort,
  ComputePoints,
  ComputeRough,
  ComputeTextMetrics,
  ComputeBounds,
  SetCursor,
  PreUpdate,
  PostUpdate,
  StartUp,
  Deleter,
  Last,
  PropagateTransforms,
  ComputeVisibility,
  ExportSVG,
  Select,
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
  Visibility,
  GPUResource,
  Name,
  ToBeDeleted,
  SizeAttenuation,
  StrokeAttenuation,
  ComputedVisibility,
  Font,
  MaterialDirty,
  GeometryDirty,
  TextDecoration,
  Brush,
  Marker,
  Line,
  LockAspectRatio,
  Editable,
  Filter,
  Locked,
  ClipMode,
  Flex,
  Canvas
} from '../components';

export interface RendererPluginOptions {
  setupDeviceSystemCtor?: SystemType<any>;
  rendererSystemCtor?: SystemType<any>;
}

function createRendererPlugin(options: RendererPluginOptions = {}): Plugin {
  return () => {
    /**
     * Components
     */
    component(GPUResource);
    component(Renderable);
    component(Name);
    component(LockAspectRatio);
    component(Wireframe);
    component(GlobalRenderOrder);
    component(Visibility);
    component(ComputedVisibility);
    component(ToBeDeleted);
    component(SizeAttenuation);
    component(StrokeAttenuation);
    component(GeometryDirty);
    component(MaterialDirty);
    component(Editable);
    component(Locked);
    component(Flex);

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
    component(Font);
    component(TextDecoration);
    component(Marker);
    component(Filter);
    component(ClipMode);

    /**
     * Geometry
     */
    component(Circle);
    component(Ellipse);
    component(Rect);
    component(Line);
    component(Polyline);
    component(Path);
    component(Text);
    component(Brush);
    component(ComputedPoints);
    component(ComputedRough);
    component(ComputedTextMetrics);
    component(ComputedBounds);

    const SetupDeviceSystem = options.setupDeviceSystemCtor ?? SetupDevice;
    system(StartUp)(SetupDeviceSystem);
    system((s) => s.before(Select))(SetupDeviceSystem);
    system(PreUpdate)(ComputePoints);
    system(PreUpdate)(ComputeRough);
    system(PreUpdate)(ComputeTextMetrics);
    system(PreUpdate)(ComputeVisibility);
    system(PostUpdate)(ComputeBounds);
    system(PostUpdate)(Sort);

    // system((s) => s.after(PropagateTransforms))(ComputeVisibility);
    system((s) => s.after(PropagateTransforms, Sort))(ComputeBounds);

    system(Last)(SetCursor);
    
    const RenderSystem = options.rendererSystemCtor ?? MeshPipeline;
    system(Last)(RenderSystem);
    system((s) => s.before(Deleter, ExportSVG))(RenderSystem);

    system(Last)(Deleter);
  };
}

export const RendererPlugin: PluginWithConfig<RendererPluginOptions> = {
  configure(options) {
    const plugin = createRendererPlugin(options);
    return plugin;
  },
};

export const DefaultRendererPlugin = RendererPlugin.configure({});
