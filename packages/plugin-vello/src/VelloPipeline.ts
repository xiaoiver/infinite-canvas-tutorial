import { mat3 } from 'gl-matrix';
import {
  co, Entity, System,
  Camera,
  Canvas,
  CheckboardStyle,
  Children,
  Circle,
  ComputedBounds,
  ComputedCamera,
  ComputedPoints,
  ComputedRough,
  ComputedTextMetrics,
  Culled,
  DropShadow,
  Ellipse,
  FillGradient,
  FillImage,
  FillPattern,
  FillSolid,
  FillTexture,
  FractionalIndex,
  GlobalRenderOrder,
  GlobalTransform,
  GPUResource,
  Grid,
  InnerShadow,
  Line,
  Opacity,
  Path,
  Polyline,
  RasterScreenshotRequest,
  Rect,
  Renderable,
  Rough,
  Screenshot,
  SizeAttenuation,
  StrokeAttenuation,
  Stroke,
  Text,
  Theme,
  ToBeDeleted,
  Wireframe,
  MaterialDirty,
  GeometryDirty,
  TextDecoration,
  Parent,
  UI,
  ZIndex,
  Brush,
  Marker,
  VectorNetwork,
  Filter,
  Transform,
  Mat3,
  Locked,
  ClipMode,
  Flex,
  Effect, 
  API,
  safeAddComponent,
  getSceneRoot,
  SerializedNode
} from '@infinite-canvas-tutorial/ecs';
import init, { addRect, addCircle, addText, registerDefaultFont, runWithCanvas } from '@infinite-canvas-tutorial/vello-renderer';
import { InitVello } from './InitVello';

type GPURenderer = {
  uniformBuffer: Buffer;
  uniformLegacyObject: Record<string, unknown>;
};

export class VelloPipeline extends System {
  private initVello = this.attach(InitVello);

  private canvases = this.query((q) => q.current.with(Canvas).read);

  private cameras = this.query(
    (q) => q.addedOrChanged.with(ComputedCamera).trackWrites,
  );

  private renderables = this.query(
    (q) =>
      q.added.and.changed.and.removed
        .with(Renderable)
        .withAny(
          Circle,
          Ellipse,
          Rect,
          Line,
          Polyline,
          Path,
          Text,
          Brush,
          VectorNetwork,
          Transform,
        ).trackWrites,
  );

  private lines = this.query((q) => q.added.and.removed.with(Line));
  private polylines = this.query((q) => q.added.and.removed.with(Polyline));
  private paths = this.query((q) => q.added.and.removed.with(Path));
  private vectorNetworks = this.query((q) =>
    q.added.and.removed.with(VectorNetwork),
  );

  private toBeDeleted = this.query(
    (q) => q.addedOrChanged.with(ToBeDeleted).trackWrites,
  );

  private culleds = this.query(
    (q) => q.addedOrChanged.and.removed.with(Culled).trackWrites,
  );

  private grids = this.query(
    (q) => q.addedChangedOrRemoved.with(Grid).trackWrites,
  );
  private themes = this.query(
    (q) => q.addedChangedOrRemoved.with(Theme).trackWrites,
  );

  private rasterScreenshotRequests = this.query(
    (q) => q.addedChangedOrRemoved.with(RasterScreenshotRequest).trackWrites,
  );

  private fillSolids = this.query(
    (q) => q.addedChangedOrRemoved.with(FillSolid).trackWrites,
  );
  private fillGradients = this.query(
    (q) => q.addedChangedOrRemoved.with(FillGradient).trackWrites,
  );
  private fillPatterns = this.query(
    (q) => q.addedChangedOrRemoved.with(FillPattern).trackWrites,
  );
  private fillTextures = this.query(
    (q) => q.addedChangedOrRemoved.with(FillTexture).trackWrites,
  );
  private fillImages = this.query(
    (q) => q.addedChangedOrRemoved.with(FillImage).trackWrites,
  );
  private strokes = this.query(
    (q) => q.addedChangedOrRemoved.with(Stroke).trackWrites,
  );
  private opacities = this.query(
    (q) => q.addedChangedOrRemoved.with(Opacity).trackWrites,
  );
  private innerShadows = this.query(
    (q) => q.addedChangedOrRemoved.with(InnerShadow).trackWrites,
  );
  private dropShadows = this.query(
    (q) => q.addedChangedOrRemoved.with(DropShadow).trackWrites,
  );
  private wireframes = this.query(
    (q) => q.addedChangedOrRemoved.with(Wireframe).trackWrites,
  );
  private roughs = this.query(
    (q) => q.addedChangedOrRemoved.with(Rough).trackWrites,
  );
  private fractionalIndexes = this.query(
    (q) => q.addedChangedOrRemoved.with(FractionalIndex).trackWrites,
  );
  private textDecorations = this.query(
    (q) => q.addedChangedOrRemoved.with(TextDecoration).trackWrites,
  );
  private sizeAttenuations = this.query(
    (q) => q.addedChangedOrRemoved.with(SizeAttenuation).trackWrites,
  );
  private strokeAttenuations = this.query(
    (q) => q.addedChangedOrRemoved.with(StrokeAttenuation).trackWrites,
  );
  private markers = this.query(
    (q) => q.addedChangedOrRemoved.with(Marker).trackWrites,
  );
  private filters = this.query(
    (q) => q.addedChangedOrRemoved.with(Filter).trackWrites,
  );
  private clipModes = this.query(
    (q) => q.addedChangedOrRemoved.with(ClipMode).trackWrites,
  );

  renderers: Map<Entity, GPURenderer> = new Map();

  private pendingRenderables: WeakMap<
    Entity,
    {
      type: 'add' | 'remove';
      entity: Entity;
    }[]
  > = new WeakMap();

  

  constructor() {
    super();
    this.query(
      (q) =>
        q.current
          .with(
            Theme,
            Grid,
            GPUResource,
            Camera,
            ComputedCamera,
            Parent,
            Children,
            Circle,
            Ellipse,
            Rect,
            Line,
            Polyline,
            Path,
            ComputedPoints,
            ComputedBounds,
            GlobalTransform,
            Opacity,
            Stroke,
            InnerShadow,
            DropShadow,
            Wireframe,
            GlobalRenderOrder,
            Rough,
            ComputedRough,
            Text,
            ComputedTextMetrics,
            FillImage,
            FillPattern,
            FillGradient,
            FillSolid,
            FillTexture,
            FractionalIndex,
            SizeAttenuation,
            StrokeAttenuation,
            TextDecoration,
            UI,
            ZIndex,
            Marker,
            Locked,
            ClipMode,
            Flex,
          )
          .read.and.using(
            RasterScreenshotRequest,
            Screenshot,
            GeometryDirty,
            MaterialDirty,
          ).write,
    );
  }

  private renderCamera(canvas: Entity, camera: Entity, sort = false) {
    console.log('renderCamera', canvas, camera);

    const { api, element } = canvas.read(Canvas);
    const canvasId = this.initVello.canvasIds.get(element as HTMLCanvasElement);
    if (!canvasId) {
      return;
    }

    if (this.pendingRenderables.has(camera)) {
      this.pendingRenderables.get(camera).forEach(({ type, entity }) => {
        if (type === 'remove') {
          // batchManager.remove(entity, !entity.has(Culled));
        } else {
          const node = api.getNodeByEntity(entity);

          console.log('node', node);
          
          if (entity.has(Circle)) {
            addCircle(canvasId, node);
          } else if (entity.has(Rect)) {
            addRect(canvasId, node);
          }
        }
      });
      this.pendingRenderables.delete(camera);
    }
  }

  execute() {
    new Set([
      ...this.renderables.added,
      ...this.renderables.changed,
      ...this.polylines.added,
      ...this.lines.added,
      ...this.paths.added,
      ...this.vectorNetworks.added,
      ...this.culleds.removed,
    ]).forEach((entity) => {
      const camera = getSceneRoot(entity);

      // TODO: batchable

      if (this.renderables.added.includes(entity)) {
        safeAddComponent(entity, GeometryDirty);
        safeAddComponent(entity, MaterialDirty);
      }

      if (this.renderables.changed.includes(entity)) {
        if (
          entity.has(Line) ||
          entity.has(Polyline) ||
          entity.has(Path) ||
          entity.has(Text) ||
          entity.has(Rough) ||
          entity.has(Brush)
        ) {
          safeAddComponent(entity, GeometryDirty);
        }
        if (entity.has(Text)) {
          safeAddComponent(entity, MaterialDirty);
        }
      }

      // The gpu resources is not ready for the camera.
      if (!this.pendingRenderables.has(camera)) {
        this.pendingRenderables.set(camera, []);
      }

      this.pendingRenderables.get(camera).push({
        type: 'add',
        entity,
      });
    });

    new Set([
      ...this.toBeDeleted.addedOrChanged,
      ...this.renderables.removed,
      ...this.polylines.removed,
      ...this.lines.removed,
      ...this.paths.removed,
      ...this.vectorNetworks.removed,
      ...this.culleds.addedOrChanged,
    ]).forEach((entity) => {
      const camera = getSceneRoot(entity);

      // The gpu resources is not ready for the camera.
      if (!this.pendingRenderables.has(camera)) {
        this.pendingRenderables.set(camera, []);
      }
      this.pendingRenderables.get(camera).push({
        type: 'remove',
        entity,
      });
    });

    // Handle some special cases.
    [
      ...this.strokes.addedChangedOrRemoved,
      ...this.markers.addedChangedOrRemoved,
    ].forEach((entity) => {
      if (entity.has(Polyline) || entity.has(Path) || entity.has(Line)) {
        safeAddComponent(entity, GeometryDirty);
      }
    });

    this.canvases.current.forEach((canvas) => {
      let toRender =
        this.grids.addedChangedOrRemoved.includes(canvas) ||
        this.themes.addedChangedOrRemoved.includes(canvas) ||
        this.rasterScreenshotRequests.addedChangedOrRemoved.includes(canvas);

      const { cameras } = canvas.read(Canvas);
      cameras.forEach((camera) => {
        if (!toRender && this.pendingRenderables.get(camera)) {
          const pendingRenderables = this.pendingRenderables.get(camera);
          toRender = !!pendingRenderables.length;
        }

        if (!toRender && this.cameras.addedOrChanged.includes(camera)) {
          toRender = true;
        }

        if (
          !toRender &&
          (!!this.fillSolids.addedChangedOrRemoved.length ||
            !!this.fillGradients.addedChangedOrRemoved.length ||
            !!this.fillPatterns.addedChangedOrRemoved.length ||
            !!this.fillTextures.addedChangedOrRemoved.length ||
            !!this.fillImages.addedChangedOrRemoved.length ||
            !!this.strokes.addedChangedOrRemoved.length ||
            !!this.opacities.addedChangedOrRemoved.length ||
            !!this.innerShadows.addedChangedOrRemoved.length ||
            !!this.dropShadows.addedChangedOrRemoved.length ||
            !!this.wireframes.addedChangedOrRemoved.length ||
            !!this.roughs.addedChangedOrRemoved.length ||
            !!this.fractionalIndexes.addedChangedOrRemoved.length ||
            !!this.textDecorations.addedChangedOrRemoved.length ||
            !!this.sizeAttenuations.addedChangedOrRemoved.length ||
            !!this.strokeAttenuations.addedChangedOrRemoved.length ||
            !!this.markers.addedChangedOrRemoved.length ||
            !!this.filters.addedChangedOrRemoved.length ||
            !!this.clipModes.addedChangedOrRemoved.length)
        ) {
          toRender = true;
        }

        if (toRender) {
          this.renderCamera(canvas, camera, true);
        }
      });
    });
  }

  finalize() {
  }
}
