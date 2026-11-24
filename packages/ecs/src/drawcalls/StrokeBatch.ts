import type { Entity } from '@lastolivegames/becsy';
import { SmoothPolyline, updateBuffer } from './SmoothPolyline';
import {
  Path,
  Stroke,
  GlobalTransform,
  GlobalRenderOrder,
  Opacity,
  Rough,
  UI,
  FillTexture,
  Wireframe,
  SizeAttenuation,
  StrokeAttenuation,
  Filter,
  DropShadow,
  InnerShadow,
  ClipMode,
  NodeLayerBlendMode,
  Extrude3D,
  Marker,
} from '../components';
import { getEnabledFillLayers, fillLayerOpacity } from '../utils/fillLayers';
import { getEnabledStrokeLayers } from '../utils/strokeLayers';
import {
  STROKE_BATCH_PAGE_SIZE,
  StrokeSegmentCache,
} from '../utils/stroke-batching';

import { PathGeometryCache } from '../utils/path-rendering';

// Devices and shapes are weak keys. Curve levels share parsed commands while
// each page keeps independent hysteresis; segments weakly follow sampled levels.
const screenCaches = new WeakMap<
  object,
  {
    geometry: WeakMap<Entity, PathGeometryCache>;
    segments: StrokeSegmentCache<ReturnType<typeof updateBuffer>>;
  }
>();

function screenStrokeCaches(device: object) {
  let caches = screenCaches.get(device);
  if (!caches)
    screenCaches.set(
      device,
      (caches = {
        geometry: new WeakMap(),
        segments: new StrokeSegmentCache(),
      }),
    );
  return caches;
}

/** Ordered, screen-only pages; never retain an empty style page. */
export class StrokeBatch extends SmoothPolyline {
  protected maxInstances = STROKE_BATCH_PAGE_SIZE;
  #placements: number[] = [];
  protected override createPathGeometryCache(shape: Entity) {
    const caches = screenStrokeCaches(this.device).geometry;
    let geometry = caches.get(shape);
    if (!geometry) caches.set(shape, (geometry = new PathGeometryCache()));
    return geometry.fork();
  }

  static override retainEmptyPage = false;
  protected override get strokeBatch() {
    return true;
  }

  protected override getStrokeBuffers(shape: Entity) {
    const { linecap, linejoin } = shape.read(Stroke);
    return screenStrokeCaches(this.device).segments.get(
      shape,
      this.pathPoints.get(shape),
      linecap,
      linejoin,
      () => super.getStrokeBuffers(shape),
    );
  }

  static override batchKey(shape: Entity): string | null {
    if (
      !shape.has(Path) ||
      !shape.has(Stroke) ||
      !shape.has(GlobalTransform) ||
      shape.hasSomeOf(
        Rough,
        UI,
        FillTexture,
        Wireframe,
        SizeAttenuation,
        StrokeAttenuation,
        Filter,
        DropShadow,
        InnerShadow,
        ClipMode,
        NodeLayerBlendMode,
        Extrude3D,
      ) ||
      getEnabledFillLayers(shape).length
    )
      return null;
    if (shape.has(Marker)) {
      const marker = shape.read(Marker);
      if (marker.start !== 'none' || marker.end !== 'none') return null;
    }
    const layers = getEnabledStrokeLayers(shape);
    if (
      layers.length !== 1 ||
      layers[0].type !== 'solid' ||
      typeof layers[0].value !== 'string' ||
      !layers[0].value.trim() ||
      layers[0].value.toLowerCase() === 'none' ||
      (layers[0].blendMode && layers[0].blendMode !== 'normal')
    )
      return null;
    const s = shape.read(Stroke),
      { matrix: m } = shape.read(GlobalTransform);
    const opacity = shape.has(Opacity) ? shape.read(Opacity).opacity : 1;
    if (
      !shape.read(Path).d ||
      m.m00 !== 1 ||
      m.m01 !== 0 ||
      m.m10 !== 0 ||
      m.m11 !== 1 ||
      m.m02 !== 0 ||
      m.m12 !== 0 ||
      m.m22 !== 1 ||
      (s.dasharray[0] ?? 0) !== 0 ||
      (s.dasharray[1] ?? 0) !== 0 ||
      ![m.m20, m.m21, s.width, s.miterlimit, s.dashoffset, opacity].every(
        Number.isFinite,
      ) ||
      s.width <= 0
    )
      return null;
    return JSON.stringify([
      layers[0].value,
      fillLayerOpacity(layers[0].opacity),
      s.width,
      s.alignment,
      s.linecap,
      s.linejoin,
      s.miterlimit,
      s.dashoffset,
      s.dashcap,
      opacity,
    ]);
  }

  override validate(shape: Entity) {
    const key = StrokeBatch.batchKey(shape);
    return (
      key !== null &&
      this.shapes.length < STROKE_BATCH_PAGE_SIZE &&
      StrokeBatch.batchKey(this.shapes[0]) === key
    );
  }

  protected override prepareGeometry(scene: Record<string, unknown>) {
    if (
      this.dirtyInstances.size ||
      this.#placements.length !== this.shapes.length * 3
    )
      this.geometryDirty = true;
    this.shapes.forEach((shape, row) => {
      const { matrix: m } = shape.read(GlobalTransform),
        i = row * 3;
      const order = shape.has(GlobalRenderOrder)
        ? shape.read(GlobalRenderOrder).value
        : 0;
      if (
        this.#placements[i] !== m.m20 ||
        this.#placements[i + 1] !== m.m21 ||
        this.#placements[i + 2] !== order
      )
        this.geometryDirty = true;
      this.#placements[i] = m.m20;
      this.#placements[i + 1] = m.m21;
      this.#placements[i + 2] = order;
    });
    this.#placements.length = this.shapes.length * 3;
    super.prepareGeometry(scene);
  }

  override createGeometry() {
    super.createGeometry();
    this.dirtyInstances.clear();
  }

  override destroy() {
    if (this.destroyed) return;
    this.vertexBuffers = [...new Set(this.vertexBuffers)];
    // Empty/degenerate pages may retire before a material/program was created.
    if (!this.program) {
      this.indexBuffer?.destroy();
      this.vertexBuffers.forEach((buffer) => buffer.destroy());
      this.vertexBuffers = [];
    }
    super.destroy();
    this.#placements = [];
    this.shapes = [];
    this.pointsBuffer = [];
    this.travelBuffer = [];
  }
}
