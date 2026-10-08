import { parsePath } from './curve/shape-path';
import { curvePathBounds, flattenPath, PathPoints } from './curve/adaptive';

// Match the standalone core implementation; no cross-package runtime dependency.
export class PathGeometryCache {
  private d: string;
  private subPaths: ReturnType<typeof parsePath>['subPaths'];
  private levels = new Map<string, PathPoints>();
  private scale = 0;
  private radius = 0;

  get(d: string, scale: number, strokeRadius = 0): PathPoints {
    if (!this.subPaths || d !== this.d) {
      this.d = d;
      this.subPaths = parsePath(d || '').subPaths;
      this.levels.clear();
      this.scale = this.radius = 0;
    }
    this.scale = precisionBucket(scale, this.scale);
    this.radius =
      strokeRadius > 0 ? precisionBucket(strokeRadius, this.radius) : 0;
    const key = `${this.scale}:${this.radius}`;
    let points = this.levels.get(key);
    if (!points) points = flattenPath(this.subPaths, this.scale, this.radius);
    this.levels.delete(key);
    this.levels.set(key, points);
    // Bound retained CPU geometry while allowing quick zoom-out/zoom-in reuse.
    if (this.levels.size > 4)
      this.levels.delete(this.levels.keys().next().value);
    return points;
  }
}

function precisionBucket(value: number, previous: number) {
  value = Number.isFinite(value) ? Math.max(value, 1e-12) : 1;
  // Refine immediately; coarsen only a full extra octave below the boundary.
  if (value <= previous && value > previous / 4) return previous;
  return 2 ** Math.ceil(Math.log2(value));
}

const boundsCache = new Map<string, ReturnType<typeof curvePathBounds>>();
export function pathGeometryBounds(d: string) {
  let bounds = boundsCache.get(d);
  if (!bounds) bounds = curvePathBounds(parsePath(d).subPaths);
  boundsCache.delete(d);
  boundsCache.set(d, bounds);
  if (boundsCache.size > 64)
    boundsCache.delete(boundsCache.keys().next().value);
  return bounds;
}

function maxScale(a: number, b: number, c: number, d: number) {
  // Largest singular value, including shear, reflections and nonuniform scale.
  return (Math.hypot(a + d, b - c) + Math.hypot(a - d, b + c)) / 2;
}

/** Derive precision from the actual render pass (also works for DPR and exports). */
export function pathScreenMetrics(
  uniforms: Record<string, unknown>,
  model: { a: number; b: number; c: number; d: number },
) {
  const p = uniforms.u_ProjectionMatrix as ArrayLike<number>;
  const v = uniforms.u_ViewMatrix as ArrayLike<number>;
  const viewport = uniforms.u_Viewport as ArrayLike<number>;
  if (!p || !v || !viewport) return { scale: 1, strokeScale: 1 };
  const a = ((p[0] * v[0] + p[3] * v[1]) * viewport[0]) / 2;
  const b = ((p[1] * v[0] + p[4] * v[1]) * viewport[1]) / 2;
  const c = ((p[0] * v[3] + p[3] * v[4]) * viewport[0]) / 2;
  const d = ((p[1] * v[3] + p[4] * v[4]) * viewport[1]) / 2;
  const scale = maxScale(
    a * model.a + c * model.b,
    b * model.a + d * model.b,
    a * model.c + c * model.d,
    b * model.c + d * model.d,
  );
  const largest = maxScale(model.a, model.b, model.c, model.d);
  const determinant = Math.abs(model.a * model.d - model.b * model.c);
  // The stroke shader extrudes in world space. Condition number bounds the
  // change in tangent angle under a nonuniform model transform.
  const condition = determinant > 0 ? (largest * largest) / determinant : 1;
  return { scale, strokeScale: maxScale(a, b, c, d) * condition * condition };
}
