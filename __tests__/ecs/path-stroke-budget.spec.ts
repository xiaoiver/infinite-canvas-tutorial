import * as core from '../../packages/core/src/utils/path-rendering';
import * as ecs from '../../packages/ecs/src/utils/path-rendering';
import * as coreCurves from '../../packages/core/src/utils/curve';
import * as ecsCurves from '../../packages/ecs/src/utils/curve';

type Point = ArrayLike<number>;
function distance(p: Point, points: Point[]) {
  let result = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy) || 0,
      ),
    );
    result = Math.min(
      result,
      Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy),
    );
  }
  return result;
}
const workflow = 'M0 0 C70 0 -30 160 40 160';
const cases = [
  workflow,
  'M0 0 C0 300 300 -300 300 0',
  'M0 0 C200 300 -200 300 0 0',
  'M0 0 C300 0 -300 0 0 0',
  'M0 0 Q80 220 300 0',
  'M100 0 A100 30 35 1 1 -100 0',
];
describe.each([
  ['core', core, coreCurves],
  ['ecs', ecs, ecsCurves],
] as const)(
  '%s thin screen stroke error budget',
  (_name, implementation, curves) => {
    it('reduces low-zoom Workflow curve points without changing full or thick precision', () => {
      const full = new implementation.PathGeometryCache();
      const screen = new implementation.PathGeometryCache(true);
      const original = full.get(workflow, 1 / 32, 1 / 32);
      const low = screen.get(workflow, 1 / 32, 1 / 32);
      expect(low[0].length).toBeLessThan(original[0].length);
      expect(
        new implementation.PathGeometryCache().get(workflow, 1 / 32, 1 / 32),
      ).toEqual(original);
      for (const radius of [1, 2, 16, 256]) {
        expect(
          new implementation.PathGeometryCache(true).get(workflow, 4, radius),
        ).toEqual(
          new implementation.PathGeometryCache().get(workflow, 4, radius),
        );
      }
      // Fill sampling never spends the stroke budget, even in a screen cache.
      expect(screen.get(workflow, 1 / 32, 0)).toEqual(
        full.get(workflow, 1 / 32, 0),
      );
    });

    it.each(cases)(
      'retains the centerline half-budget and exact endpoints: %s',
      (d) => {
        for (const scale of [1 / 64, 1 / 8, 0.5, 2]) {
          const path = curves.parsePath(d).subPaths[0];
          const points = new implementation.PathGeometryCache(true).get(
            d,
            scale,
            0.25,
          )[0];
          for (const curve of path.curves) {
            for (let i = 0; i <= 2000; i++)
              expect(
                distance(curve.getPoint(i / 2000, [0, 0]), points) * scale,
              ).toBeLessThanOrEqual(0.125 + 1e-9);
          }
          expect(points[0]).toEqual(path.curves[0].getPoint(0, [0, 0]));
          expect(points.at(-1)).toEqual(
            path.curves.at(-1)!.getPoint(1, [0, 0]),
          );
          expect(points.length).toBeLessThanOrEqual(4097);
        }
      },
    );

    it('keeps endpoint normals and smooth miter extensions inside the stroke half-budget', () => {
      const d = 'M0 0 C0 100 100 100 100 0';
      for (const scale of [1 / 64, 1 / 8, 0.5, 2]) {
        for (const radius of [1 / 64, 1 / 8, 0.5]) {
          const points = new implementation.PathGeometryCache(true).get(
            d,
            scale,
            radius,
          )[0];
          const first = points[1],
            last = points.at(-2)!;
          // Both authored endpoint tangents are vertical.
          expect(
            (radius * Math.abs(first[0])) / Math.hypot(...first),
          ).toBeLessThanOrEqual(0.125);
          expect(
            (radius * Math.abs(100 - last[0])) /
              Math.hypot(100 - last[0], last[1]),
          ).toBeLessThanOrEqual(0.125);
          for (let i = 1; i < points.length - 1; i++) {
            const a = points[i - 1],
              b = points[i],
              c = points[i + 1];
            const x = [b[0] - a[0], b[1] - a[1]],
              y = [c[0] - b[0], c[1] - b[1]];
            const cos = Math.max(
              -1,
              Math.min(
                1,
                (x[0] * y[0] + x[1] * y[1]) /
                  (Math.hypot(...x) * Math.hypot(...y)),
              ),
            );
            expect(
              radius * (1 / Math.sqrt((1 + cos) / 2) - 1),
            ).toBeLessThanOrEqual(0.125);
          }
        }
      }
    });

    it('preserves independent hysteresis, live sample identity, source edits and authored corners', () => {
      const pool = new implementation.PathGeometryCache(true);
      const a = pool.fork(),
        b = pool.fork();
      const low = a.get(workflow, 1 / 32, 1 / 32);
      expect(b.get(workflow, 1 / 32, 1 / 32)).toBe(low);
      const high = b.get(workflow, 2, 2);
      expect(a.get(workflow, 1 / 32, 1 / 32)).toBe(low);
      expect(b.get(workflow, 1.99, 1.99)).toBe(high);
      const snapshot = JSON.stringify(low);
      const edited = workflow + ' L70 160 L70 180';
      const changed = a.get(edited, 1 / 32, 1 / 32);
      expect(changed[0].slice(-3)).toEqual([
        [40, 160],
        [70, 160],
        [70, 180],
      ]);
      expect(b.get(edited, 1 / 32, 1 / 32)).toBe(changed);
      expect(JSON.stringify(low)).toBe(snapshot);
      expect(a.get('', 1 / 32, 1 / 32)).toEqual([]);
      expect(b.get(workflow, 1 / 32, 1 / 32)).not.toBe(low);
    });
  },
);
