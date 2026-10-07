import { vec2 } from 'gl-matrix';
import { CubicBezierCurve as CoreCubic } from '../../packages/core/src/utils/curve/cubic-bezier-curve';
import { QuadraticBezierCurve as CoreQuadratic } from '../../packages/core/src/utils/curve/quadratic-bezier-curve';
import { CubicBezierCurve as EcsCubic } from '../../packages/ecs/src/utils/curve/cubic-bezier-curve';
import { QuadraticBezierCurve as EcsQuadratic } from '../../packages/ecs/src/utils/curve/quadratic-bezier-curve';

for (const [name, Cubic, Quadratic] of [
  ['core', CoreCubic, CoreQuadratic],
  ['ecs', EcsCubic, EcsQuadratic],
] as const) {
  describe(`${name} Bézier arc-length sampling`, () => {
    it('samples cubic distance instead of treating t as a distance fraction', () => {
      const curve = new Cubic(
        vec2.fromValues(0, 0),
        vec2.fromValues(0, 0),
        vec2.fromValues(0, 0),
        vec2.fromValues(1000, 0),
      );
      expect(curve.getPoint(0.5)[0]).toBeCloseTo(125);
      expect(curve.getPointAt(0.5)[0]).toBeCloseTo(500, 1);
      const target = vec2.create();
      expect(curve.getPointAt(0.75, target)).toBe(target);
      expect(target[0]).toBeCloseTo(750, 1);
    });
    it('samples quadratic distance consistently with its tangent', () => {
      const curve = new Quadratic(
        vec2.fromValues(0, 0),
        vec2.fromValues(0, 0),
        vec2.fromValues(0, 1000),
      );
      expect(curve.getPoint(0.5)[1]).toBeCloseTo(250);
      expect(curve.getPointAt(0.5)[1]).toBeCloseTo(500, 1);
      expect(Array.from(curve.getTangentAt(0.5))).toEqual([0, 1]);
    });
  });
}
