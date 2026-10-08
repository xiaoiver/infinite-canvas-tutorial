import { Entity } from '@lastolivegames/becsy';
import {
  GlobalTransform,
  Path,
  Rough,
  SizeAttenuation,
  Stroke,
  StrokeAttenuation,
} from '../components';
import { PathPoints } from '../utils/curve/adaptive';
import { PathGeometryCache, pathScreenMetrics } from '../utils/path-rendering';
import { Drawcall } from './Drawcall';

/** Render precision belongs to the drawcall, never to ComputedPoints or bounds. */
export abstract class PathDrawcall extends Drawcall {
  protected pathStroke = false;
  protected pathPoints = new WeakMap<Entity, PathPoints>();
  private pathCaches = new WeakMap<Entity, PathGeometryCache>();

  protected get geometryDefines() {
    return this.shapes.some((shape) => shape.has(Path) && !shape.has(Rough))
      ? '#define USE_ADAPTIVE_PATH\n'
      : '';
  }

  protected prepareGeometry(uniforms: Record<string, unknown>) {
    for (const shape of this.shapes) {
      if (!shape.has(Path) || shape.has(Rough)) continue;
      let cache = this.pathCaches.get(shape);
      if (!cache) this.pathCaches.set(shape, (cache = new PathGeometryCache()));
      const { matrix: m } = shape.read(GlobalTransform);
      let { scale, strokeScale } = pathScreenMetrics(uniforms, {
        a: m.m00,
        b: m.m01,
        c: m.m10,
        d: m.m11,
      });
      const zoom = Number(uniforms.u_ZoomScale) || 1;
      if (!this.pathStroke && shape.has(SizeAttenuation)) scale /= zoom;
      if (this.pathStroke && shape.has(StrokeAttenuation)) strokeScale /= zoom;
      const radius =
        this.pathStroke && shape.has(Stroke)
          ? (shape.read(Stroke).width * strokeScale) / 2
          : 0;
      const points = cache.get(shape.read(Path).d, scale, radius);
      if (this.pathPoints.get(shape) !== points) {
        this.pathPoints.set(shape, points);
        this.geometryDirty = true;
      }
    }
  }
}
