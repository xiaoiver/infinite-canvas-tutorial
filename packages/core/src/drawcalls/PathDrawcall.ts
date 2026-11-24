import { Path, Shape } from '../shapes';
import { PathPoints } from '../utils/curve/adaptive';
import { PathGeometryCache, pathScreenMetrics, pathScreenMetricsForPass } from '../utils/path-rendering';
import { Drawcall } from './Drawcall';

/** Render precision is separate from Path.points or bounds. */
export abstract class PathDrawcall extends Drawcall {
  protected pathStroke = false;
  protected pathPoints = new WeakMap<Shape, PathPoints>();
  protected pathCaches = new WeakMap<Shape, PathGeometryCache>();

  protected createPathGeometryCache(_shape: Shape) {
    return new PathGeometryCache();
  }

  // Screen-space distances can exceed mediump range at high zoom/DPR.
  protected get geometryDefines() {
    return this.shapes.some((shape) => shape instanceof Path)
      ? '#define USE_ADAPTIVE_PATH\nprecision highp float;\n'
      : '';
  }

  protected prepareGeometry(uniforms: Record<string, unknown>) {
    let metricsForPass: ReturnType<typeof pathScreenMetricsForPass> | undefined;
    for (const shape of this.shapes) {
      if (!(shape instanceof Path)) continue;
      let cache = this.pathCaches.get(shape);
      if (!cache)
        this.pathCaches.set(
          shape,
          (cache = this.createPathGeometryCache(shape)),
        );
      const m = shape.worldTransform;
      if (this.shapes.length > 1)
        metricsForPass ??= pathScreenMetricsForPass(uniforms);
      let { scale, strokeScale } = metricsForPass
        ? metricsForPass(m.a, m.b, m.c, m.d)
        : pathScreenMetrics(uniforms, m);
      const zoom = Number(uniforms.u_ZoomScale) || 1;
      if (shape.sizeAttenuation) {
        if (this.pathStroke) strokeScale /= zoom;
        else scale /= zoom;
      }
      const points = cache.get(
        shape.d,
        scale,
        this.pathStroke ? (shape.strokeWidth * strokeScale) / 2 : 0,
      );
      if (this.pathPoints.get(shape) !== points) {
        this.pathPoints.set(shape, points);
        this.geometryDirty = true;
      }
    }
  }
}
