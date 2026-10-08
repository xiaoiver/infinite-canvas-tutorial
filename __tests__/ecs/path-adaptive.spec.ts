import * as ecs from '../../packages/ecs/src/utils/path-rendering';
import * as core from '../../packages/core/src/utils/path-rendering';
import * as ecsCurve from '../../packages/ecs/src/utils/curve';
import * as coreCurve from '../../packages/core/src/utils/curve';
import {
  flattenPath,
  curvePathBounds,
} from '../../packages/ecs/src/utils/curve/adaptive';
import { Path } from '../../packages/ecs/src/components/geometry/Path';

function error(point: ArrayLike<number>, points: number[][]) {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) /
          (dx * dx + dy * dy) || 0,
      ),
    );
    distance = Math.min(
      distance,
      Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy),
    );
  }
  return distance;
}

const paths = [
  'M0 0 C0 300 300 -300 300 0', // inflection; midpoint alone appears flat
  'M0 0 C200 300 -200 300 0 0', // loop
  'M0 0 C300 0 -300 0 0 0', // collinear reversal
  'M0 0 Q80 220 300 0',
  'M100 0 A100 30 35 1 1 -100 0',
  'M100 0 A100 100 0 1 1 -100 0 A100 100 0 1 1 100 0 Z',
];

describe.each([
  ['ecs', ecs, ecsCurve],
  ['core', core, coreCurve],
] as const)('%s adaptive paths', (_name, implementation, curves) => {
  it.each(paths)('keeps screen error below a quarter pixel: %s', (d) => {
    const cache = new implementation.PathGeometryCache();
    const path = curves.parsePath(d);
    const lengths = path.subPaths.map((p) => p.getLength());
    let previousCount = 0;
    for (const scale of [0.5, 2, 16, 64]) {
      const points = cache.get(d, scale)[0];
      expect(points.length).toBeGreaterThanOrEqual(previousCount);
      previousCount = points.length;
      let maxError = 0;
      for (const curve of path.subPaths[0].curves) {
        for (let i = 0; i <= 1000; i++)
          maxError = Math.max(
            maxError,
            error(curve.getPoint(i / 1000, [0, 0]), points) * scale,
          );
      }
      expect(maxError).toBeLessThan(0.25);
    }
    expect(path.subPaths.map((p) => p.getLength())).toEqual(lengths);
  });

  it('reuses precision levels with hysteresis, invalidates edits and evicts old levels', () => {
    const cache = new implementation.PathGeometryCache();
    const first = cache.get(paths[0], 2);
    expect(cache.get(paths[0], 1.99)).toBe(first);
    const second = cache.get(paths[0], 2.01);
    expect(second).not.toBe(first);
    expect(cache.get(paths[0], 1.99)).toBe(second);
    cache.get(paths[0], 0.5);
    expect(cache.get(paths[0], 2)).toBe(first);
    expect(cache.get(paths[1], 2)).not.toBe(first);
    const edited = cache.get(paths[1], 2);
    for (const scale of [8, 32, 128, 512]) cache.get(paths[1], scale);
    expect(cache.get(paths[1], 2)).not.toBe(edited);
  });

  it('derives scale from the pass viewport, projection and full parent transform', () => {
    const uniforms = {
      u_ProjectionMatrix: [2 / 200, 0, 0, 0, -2 / 100, 0, -1, 1, 1],
      u_ViewMatrix: [8, 0, 0, 0, 8, 0, -80, 10, 1],
      u_Viewport: [400, 200],
    };
    const model = { a: 0, b: -3, c: -2, d: 0 };
    expect(implementation.pathScreenMetrics(uniforms, model).scale).toBeCloseTo(
      48,
    );
    uniforms.u_ViewMatrix[6] = 500;
    expect(implementation.pathScreenMetrics(uniforms, model).scale).toBeCloseTo(
      48,
    );
    const sheared = implementation.pathScreenMetrics(uniforms, {
      a: 1,
      b: 0,
      c: 1,
      d: 1,
    });
    expect(sheared.scale).toBeCloseTo((16 * (1 + Math.sqrt(5))) / 2);
  });

  it('uses curve extrema for bounds, independently of render precision', () => {
    const d = 'M0 0 Q30 100 100 0 C100 -60 130 -60 130 0';
    const bounds = implementation.pathGeometryBounds(d);
    expect(bounds).toEqual({ minX: 0, minY: -45, maxX: 130, maxY: 50 });
    const cache = new implementation.PathGeometryCache();
    for (const scale of [0.1, 1, 100]) {
      cache.get(d, scale);
      expect(implementation.pathGeometryBounds(d)).toEqual(bounds);
    }
    expect(implementation.pathGeometryBounds('M0 0 L10 20')).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 20,
    });
  });

  it('keeps subpaths separate, closes contours and preserves authored straight edges', () => {
    const cache = new implementation.PathGeometryCache();
    expect(cache.get('M0 0 L100 0 L100 100 Z M200 0 L300 0', 64, 100)).toEqual([
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 0],
      ],
      [
        [200, 0],
        [300, 0],
      ],
    ]);
    expect(cache.get('', 1)).toEqual([]);
    expect(cache.get('M0 0 C0 0 0 0 0 0', 64, 100)).toEqual([[[0, 0]]]);
  });

  it('bounds work at pathological precision without dropping endpoints', () => {
    const cache = new implementation.PathGeometryCache();
    const points = cache.get('M0 0 C0 100 100 100 100 0', 1e12, 1e12)[0];
    expect(points.length).toBeLessThanOrEqual(4097);
    expect(points[0]).toEqual([0, 0]);
    expect(points[points.length - 1]).toEqual([100, 0]);
    expect(points.flat().every(Number.isFinite)).toBe(true);
  });

  it('does not create a zero-length GPU segment at an ellipse seam', () => {
    const cache = new implementation.PathGeometryCache();
    const points = cache.get(
      'M100 0 A100 100 0 1 1 -100 0 A100 100 0 1 1 100 0 Z',
      64,
      96,
    )[0];
    expect(points[points.length - 1]).toEqual(points[0]);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].map(Math.fround)).not.toEqual(
        points[i - 1].map(Math.fround),
      );
      expect(
        Math.hypot(
          points[i][0] - points[i - 1][0],
          points[i][1] - points[i - 1][1],
        ),
      ).toBeGreaterThan(1e-6);
    }
  });
});

it('resolves stroke endpoint tangent and thick-curve joins', () => {
  const path = ecsCurve.parsePath('M0 0 C0 100 100 100 100 0').subPaths;
  const thin = flattenPath(path, 1)[0];
  const thick = flattenPath(path, 1, 200)[0];
  expect(thick.length).toBeGreaterThan(thin.length);
  const first = thick[1];
  // The analytic endpoint normal is horizontal; the chord must agree to < 0.25 px.
  expect((200 * Math.abs(first[0])) / Math.hypot(...first)).toBeLessThan(0.25);
});

it.each([false, true])(
  'bounds rotated ellipse arcs (clockwise=%s)',
  (clockwise) => {
    const curve = new ecsCurve.EllipseCurve(
      10,
      20,
      100,
      30,
      0.13,
      4.9,
      clockwise,
      0.71,
    );
    const path = new ecsCurve.CurvePath();
    path.add(curve);
    const bounds = curvePathBounds([path]);
    const sampled = Array.from({ length: 10001 }, (_, i) =>
      curve.getPoint(i / 10000, [0, 0]),
    );
    for (const [key, axis, fn] of [
      ['minX', 0, Math.min],
      ['maxX', 0, Math.max],
      ['minY', 1, Math.min],
      ['maxY', 1, Math.max],
    ] as const) {
      expect(bounds[key]).toBeCloseTo(fn(...sampled.map((p) => p[axis])), 4);
    }
  },
);

it('preserves external geometry bounds providers', () => {
  const original = Path.geometryBoundsProvider;
  const supplied = Path.getGeometryBounds({ d: 'M0 0 L20 20' });
  try {
    Path.geometryBoundsProvider = () => supplied;
    expect(Path.getGeometryBounds({ d: paths[0] })).toBe(supplied);
  } finally {
    Path.geometryBoundsProvider = original;
  }
});
