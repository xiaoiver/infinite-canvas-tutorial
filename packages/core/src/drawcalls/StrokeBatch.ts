import { Path, type Shape } from '../shapes';
import { SmoothPolyline } from './SmoothPolyline';
import { STROKE_BATCH_PAGE_SIZE } from '../utils/stroke-batching';

/** Ordered, screen-only pages of compatible translated Path strokes. */
export class StrokeBatch extends SmoothPolyline {
  protected maxInstances = STROKE_BATCH_PAGE_SIZE;
  #placements: number[] = [];
  protected override get strokeBatch() {
    return true;
  }

  static batchKey(shape: Shape): string | null {
    if (
      Object.getPrototypeOf(shape) !== Path.prototype ||
      !shape.batchable ||
      shape.fill !== 'none' ||
      typeof shape.stroke !== 'string' ||
      shape.stroke === 'none' ||
      shape.wireframe ||
      shape.sizeAttenuation ||
      shape.useFillImage ||
      shape.innerShadowBlurRadius > 0 ||
      shape.dropShadowBlurRadius > 0 ||
      shape.strokeDasharray.some((n) => n !== 0)
    )
      return null;
    const m = shape.worldTransform,
      c = shape.strokeRGB,
      p = shape as Path;
    if (
      !p.d ||
      !p.points.some((line) => line.length >= 2) ||
      !c ||
      m.a !== 1 ||
      m.b !== 0 ||
      m.c !== 0 ||
      m.d !== 1 ||
      ![
        m.tx,
        m.ty,
        c.r,
        c.g,
        c.b,
        c.opacity,
        shape.strokeWidth,
        shape.strokeMiterlimit,
        shape.strokeDashoffset,
        shape.opacity,
        shape.strokeOpacity,
      ].every(Number.isFinite) ||
      shape.strokeWidth <= 0
    )
      return null;
    return JSON.stringify([
      c.r,
      c.g,
      c.b,
      c.opacity,
      shape.strokeWidth,
      shape.strokeAlignment,
      shape.strokeLinecap,
      shape.strokeLinejoin,
      shape.strokeMiterlimit,
      shape.strokeDashoffset,
      shape.opacity,
      shape.strokeOpacity,
    ]);
  }

  override validate(shape: Shape) {
    const key = StrokeBatch.batchKey(shape);
    return (
      key !== null &&
      this.shapes.length < STROKE_BATCH_PAGE_SIZE &&
      StrokeBatch.batchKey(this.shapes[0]) === key
    );
  }

  protected override prepareGeometry(scene: Record<string, unknown>) {
    if (this.#placements.length !== this.shapes.length * 3)
      this.geometryDirty = true;
    this.shapes.forEach((shape, row) => {
      const m = shape.worldTransform,
        i = row * 3;
      if (
        shape.renderDirtyFlag ||
        this.#placements[i] !== m.tx ||
        this.#placements[i + 1] !== m.ty ||
        this.#placements[i + 2] !== shape.globalRenderOrder
      )
        this.geometryDirty = true;
      this.#placements[i] = m.tx;
      this.#placements[i + 1] = m.ty;
      this.#placements[i + 2] = shape.globalRenderOrder;
    });
    this.#placements.length = this.shapes.length * 3;
    super.prepareGeometry(scene);
  }

  override destroy() {
    if (this.destroyed) return;
    this.vertexBuffers = [...new Set(this.vertexBuffers)];
    super.destroy();
    this.#placements = [];
    this.shapes = [];
    this.pointsBuffer = [];
    this.travelBuffer = [];
  }
}
