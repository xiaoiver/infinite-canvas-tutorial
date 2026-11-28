import { parsePath } from './curve/shape-path';
import { curvePathBounds, flattenPath, PathPoints } from './curve/adaptive';

/** Earcut can drop triangles when nonadjacent edges share a contour vertex. */
export function hasSelfTouchingContour(contours: PathPoints): boolean {
  return contours.some((points) => {
    const seen = new Set<string>();
    let previous: string | undefined;
    const first = points.length ? `${points[0][0]},${points[0][1]}` : '';
    for (let i = 0; i < points.length; i++) {
      const key = `${points[i][0]},${points[i][1]}`;
      // Adjacent duplicates and the closing vertex are ordinary contour seams.
      if (key === previous || (i === points.length - 1 && key === first))
        continue;
      if (seen.has(key)) return true;
      seen.add(key);
      previous = key;
    }
    return false;
  });
}

// Match the standalone core implementation; no cross-package runtime dependency.
export class PathGeometryCache {
  /** Screen-only simple open Beziers; full/export callers keep legacy sampling. */
  constructor(private readonly strokeErrorBudget = false) {}
  // Contexts share parsed commands and four LRU levels, never hysteresis state.
  private geometry = {
    d: undefined as string | undefined,
    subPaths: undefined as ReturnType<typeof parsePath>['subPaths'] | undefined,
    levels: new Map<string, PathPoints>(),
    version: 0,
  };
  private version = -1;
  private scale = 0;
  private radius = 0;
  private current: PathPoints | undefined;

  /** Start an independent render context backed by the same CPU geometry. */
  fork(): PathGeometryCache {
    const context = new PathGeometryCache(this.strokeErrorBudget);
    context.geometry = this.geometry;
    return context;
  }

  get(d: string, scale: number, strokeRadius = 0): PathPoints {
    const geometry = this.geometry;
    if (!geometry.subPaths || d !== geometry.d) {
      geometry.subPaths = parsePath(d || '').subPaths;
      geometry.d = d;
      geometry.levels.clear();
      geometry.version++;
    }
    // Another context can observe an edit first; every context must drop its
    // own current hit before considering its precision fast path.
    if (this.version !== geometry.version) {
      this.version = geometry.version;
      this.scale = this.radius = 0;
      this.current = undefined;
    }
    const nextScale = precisionBucket(scale, this.scale);
    const nextRadius =
      strokeRadius > 0 ? precisionBucket(strokeRadius, this.radius) : 0;
    if (this.current && nextScale === this.scale && nextRadius === this.radius)
      return this.current;
    this.scale = nextScale;
    this.radius = nextRadius;
    const key = `${this.scale}:${this.radius}`;
    let points = geometry.levels.get(key);
    if (!points)
      points = flattenPath(
        geometry.subPaths,
        this.scale,
        this.radius,
        this.strokeErrorBudget,
      );
    geometry.levels.delete(key);
    geometry.levels.set(key, points);
    if (geometry.levels.size > 4)
      geometry.levels.delete(geometry.levels.keys().next().value);
    this.current = points;
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

/** Reuse only consecutive equal linear transforms within one synchronous pass.
 * Build a fresh scope for every camera, viewport/DPR or export pass. No scene
 * objects, geometry or metrics survive that call to prepareGeometry.
 */
export function pathScreenMetricsForPass(uniforms: Record<string, unknown>) {
  let lastA = 0, lastB = 0, lastC = 0, lastD = 0;
  let metrics: Readonly<ReturnType<typeof pathScreenMetrics>> | undefined;
  return (a: number, b: number, c: number, d: number) => {
    if (!metrics || a !== lastA || b !== lastB || c !== lastC || d !== lastD) {
      metrics = pathScreenMetrics(uniforms, { a, b, c, d });
      lastA = a;
      lastB = b;
      lastC = c;
      lastD = d;
    }
    return metrics;
  };
}
