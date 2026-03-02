import { EllipseCurve } from '../../packages/ecs/src/utils/curve';

describe('EllipseCurve', () => {
  describe('getPoint', () => {
    it('should return start point on circle when t=0', () => {
      const circle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2);
      const point = circle.getPoint(0);
      expect(point[0]).toBeCloseTo(5);  // x = radius at angle 0
      expect(point[1]).toBeCloseTo(0);  // y = 0 at angle 0
    });

    it('should return correct point at quarter circle (t=0.25)', () => {
      const circle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2);
      const point = circle.getPoint(0.25);
      expect(point[0]).toBeCloseTo(0, 10);   // cos(π/2) ≈ 0
      expect(point[1]).toBeCloseTo(5, 10);   // sin(π/2) = 1
    });

    it('should return correct point at half circle (t=0.5)', () => {
      const circle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2);
      const point = circle.getPoint(0.5);
      expect(point[0]).toBeCloseTo(-5, 10);  // cos(π) = -1
      expect(point[1]).toBeCloseTo(0, 10);   // sin(π) ≈ 0
    });

    it('should return start point when full circle and t=1', () => {
      const circle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2);
      const point = circle.getPoint(1);
      expect(point[0]).toBeCloseTo(5);
      expect(point[1]).toBeCloseTo(0);
    });

    it('should handle ellipse with different x and y radii', () => {
      const ellipse = new EllipseCurve(0, 0, 10, 5, 0, Math.PI * 2);
      const point = ellipse.getPoint(0);
      expect(point[0]).toBeCloseTo(10);
      expect(point[1]).toBeCloseTo(0);
    });

    it('should handle offset center', () => {
      const ellipse = new EllipseCurve(100, 200, 5, 5, 0, Math.PI * 2);
      const point = ellipse.getPoint(0);
      expect(point[0]).toBeCloseTo(105);
      expect(point[1]).toBeCloseTo(200);
    });

    it('should handle partial arc (not full circle)', () => {
      // Quarter circle from 0 to π/2
      const arc = new EllipseCurve(0, 0, 5, 5, 0, Math.PI / 2);
      const start = arc.getPoint(0);
      const end = arc.getPoint(1);
      expect(start[0]).toBeCloseTo(5);
      expect(start[1]).toBeCloseTo(0);
      expect(end[0]).toBeCloseTo(0, 10);
      expect(end[1]).toBeCloseTo(5, 10);
    });

    it('should handle clockwise direction', () => {
      const ccw = new EllipseCurve(0, 0, 5, 5, 0, Math.PI / 2, false);
      const cw = new EllipseCurve(0, 0, 5, 5, 0, Math.PI / 2, true);

      const ccwPoint = ccw.getPoint(0.5);
      const cwPoint = cw.getPoint(0.5);

      // Clockwise should go in opposite direction
      expect(ccwPoint[1]).toBeGreaterThan(0);
      expect(cwPoint[1]).toBeLessThan(0);
    });

    it('should handle rotation', () => {
      const ellipse = new EllipseCurve(0, 0, 5, 3, 0, Math.PI * 2, false, Math.PI / 4);
      const point = ellipse.getPoint(0);
      // After 45 degree rotation, the point at t=0 should be rotated
      expect(point[0]).not.toBeCloseTo(5);
      expect(point[1]).not.toBeCloseTo(0);
    });

    it('should handle zero radius as degenerate case', () => {
      const ellipse = new EllipseCurve(0, 0, 0, 0, 0, Math.PI * 2);
      const point = ellipse.getPoint(0.5);
      expect(point[0]).toBeCloseTo(0);
      expect(point[1]).toBeCloseTo(0);
    });
  });

  describe('getLength', () => {
    it('should calculate approximate circumference for circle', () => {
      const circle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2);
      const length = circle.getLength();
      // Circumference = 2 * π * r ≈ 31.4159
      expect(length).toBeCloseTo(31.416, 1);
    });

    it('should calculate half circle length', () => {
      const semicircle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI);
      const length = semicircle.getLength();
      // Half circumference ≈ 15.708
      expect(length).toBeCloseTo(15.708, 1);
    });

    it('should calculate quarter circle length', () => {
      const quarter = new EllipseCurve(0, 0, 5, 5, 0, Math.PI / 2);
      const length = quarter.getLength();
      // Quarter circumference ≈ 7.854
      expect(length).toBeCloseTo(7.854, 1);
    });

    it('should return 0 for zero angle span', () => {
      const ellipse = new EllipseCurve(0, 0, 5, 5, 0, 0);
      expect(ellipse.getLength()).toBeCloseTo(0);
    });

    it('should handle ellipse perimeter approximation', () => {
      // Ramanujan approximation for ellipse perimeter
      const ellipse = new EllipseCurve(0, 0, 10, 5, 0, Math.PI * 2);
      const length = ellipse.getLength();
      // Should be between circle with r=5 and circle with r=10
      expect(length).toBeGreaterThan(31.4);
      expect(length).toBeLessThan(62.9);
    });
  });

  describe('getPointAt', () => {
    it('should return equidistant points on circle', () => {
      const circle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2);
      const p0 = circle.getPointAt(0);
      const pHalf = circle.getPointAt(0.5);
      const p1 = circle.getPointAt(1);

      expect(p0[0]).toBeCloseTo(5);
      expect(p1[0]).toBeCloseTo(5);
      expect(pHalf[0]).toBeCloseTo(-5, 10);
    });

    it('should handle arc length parametrization', () => {
      const arc = new EllipseCurve(0, 0, 5, 5, 0, Math.PI);
      const midPoint = arc.getPointAt(0.5);
      // At halfway along the semicircle, should be at top/bottom
      expect(midPoint[0]).toBeCloseTo(0, 10);
      expect(Math.abs(midPoint[1])).toBeCloseTo(5, 10);
    });
  });

  describe('getPoints', () => {
    it('should generate correct number of points', () => {
      const circle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2);
      const points = circle.getPoints(4);
      expect(points).toHaveLength(5);
    });

    it('should start and end at same point for full circle', () => {
      const circle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2);
      const points = circle.getPoints(4);
      const first = points[0];
      const last = points[points.length - 1];
      expect(first[0]).toBeCloseTo(last[0]);
      expect(first[1]).toBeCloseTo(last[1]);
    });
  });

  describe('getTangent', () => {
    it('should return tangent perpendicular to radius at t=0', () => {
      const circle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2);
      const tangent = circle.getTangent(0);
      // At angle 0, tangent should point upward (0, 1) or downward (0, -1)
      expect(Math.abs(tangent[0])).toBeLessThan(0.1);
      expect(Math.abs(tangent[1])).toBeCloseTo(1, 1);
    });

    it('should return unit tangent vector', () => {
      const ellipse = new EllipseCurve(0, 0, 10, 5, 0, Math.PI * 2);
      for (let t = 0; t <= 1; t += 0.25) {
        const tangent = ellipse.getTangent(t);
        const length = Math.sqrt(tangent[0] ** 2 + tangent[1] ** 2);
        expect(length).toBeCloseTo(1, 5);
      }
    });

    it('should have tangent perpendicular to position vector for circle', () => {
      const circle = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2);
      const t = 0.25; // 90 degrees
      const point = circle.getPoint(t);
      const tangent = circle.getTangent(t);

      // Dot product should be close to 0 for perpendicular vectors
      const dot = point[0] * tangent[0] + point[1] * tangent[1];
      expect(dot).toBeCloseTo(0, 1);
    });
  });

  describe('angle wrapping', () => {
    it('should handle negative start angle', () => {
      const ellipse = new EllipseCurve(0, 0, 5, 5, -Math.PI / 2, Math.PI / 2);
      const start = ellipse.getPoint(0);
      const end = ellipse.getPoint(1);

      // From -90 to 90 degrees
      expect(start[0]).toBeCloseTo(0, 10);
      expect(start[1]).toBeCloseTo(-5, 10);
      expect(end[0]).toBeCloseTo(0, 10);
      expect(end[1]).toBeCloseTo(5, 10);
    });

    it('should handle angles greater than 2π', () => {
      const ellipse = new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 3);
      // Should normalize to valid range
      const length = ellipse.getLength();
      expect(length).toBeGreaterThan(15.7); // More than full circle
    });

    it('should handle same start and end angles as full circle', () => {
      const ellipse = new EllipseCurve(0, 0, 5, 5, Math.PI / 4, Math.PI / 4);
      const length = ellipse.getLength();
      expect(length).toBeCloseTo(0, 1); // Should be full circle
    });
  });

  describe('clone and copy', () => {
    it('should clone ellipse with all properties', () => {
      const original = new EllipseCurve(10, 20, 30, 40, 0, Math.PI, true, Math.PI / 4);
      original.arcLengthDivisions = 100;

      const cloned = original.clone();

      expect(cloned.aX).toBe(0);
      expect(cloned.aY).toBe(0);
      expect(cloned.xRadius).toBe(1);
      expect(cloned.yRadius).toBe(1);
      expect(cloned.aStartAngle).toBe(0);
      expect(cloned.aEndAngle).toBe(2 * Math.PI);
      expect(cloned.aClockwise).toBe(false);
      expect(cloned.aRotation).toBe(0);
      expect(cloned.arcLengthDivisions).toBe(100);
    });
  });
});
