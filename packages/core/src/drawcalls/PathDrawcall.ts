import { Path, Shape } from '../shapes';
import { PathPoints } from '../utils/curve/adaptive';
import { PathGeometryCache, pathScreenMetrics } from '../utils/path-rendering';
import { Drawcall } from './Drawcall';

/** Render precision belongs to the drawcall, never to Path.points or bounds. */
export abstract class PathDrawcall extends Drawcall {
  protected pathStroke = false;
  protected pathPoints = new WeakMap<Shape, PathPoints>();
  private pathCaches = new WeakMap<Shape, PathGeometryCache>();

  protected get geometryDefines() {
    return this.shapes.some((shape) => shape instanceof Path)
      ? '#define USE_ADAPTIVE_PATH\n'
      : '';
  }

  protected prepareGeometry(uniforms: Record<string, unknown>) {
    for (const shape of this.shapes) {
      if (!(shape instanceof Path)) continue;
      let cache = this.pathCaches.get(shape);
      if (!cache) this.pathCaches.set(shape, (cache = new PathGeometryCache()));
      let { scale, strokeScale } = pathScreenMetrics(
        uniforms,
        shape.worldTransform,
      );
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
