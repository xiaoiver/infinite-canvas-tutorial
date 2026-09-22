import { LineCurve } from '../../packages/ecs/src/utils/curve';

describe('LineCurve', () => {
  describe('getPoint', () => {
    it('should return start point when t=0', () => {
      const line = new LineCurve([0, 0], [10, 10]);
      const point = line.getPoint(0);
      expect(point[0]).toBeCloseTo(0);
      expect(point[1]).toBeCloseTo(0);
    });

    it('should return end point when t=1', () => {
      const line = new LineCurve([0, 0], [10, 10]);
      const point = line.getPoint(1);
      expect(point[0]).toBeCloseTo(10);
      expect(point[1]).toBeCloseTo(10);
    });

    it('should return midpoint when t=0.5', () => {
      const line = new LineCurve([0, 0], [10, 10]);
      const point = line.getPoint(0.5);
      expect(point[0]).toBeCloseTo(5);
      expect(point[1]).toBeCloseTo(5);
    });

    it('should interpolate correctly for arbitrary t values', () => {
      const line = new LineCurve([0, 0], [100, 0]);
      const point = line.getPoint(0.25);
      expect(point[0]).toBeCloseTo(25);
      expect(point[1]).toBeCloseTo(0);
    });

    it('should support custom vec2 target', () => {
      const line = new LineCurve([0, 0], [10, 10]);
      const target = new Float32Array([0, 0]);
      const point = line.getPoint(0.5, target);
      expect(point).toBe(target);
      expect(point[0]).toBeCloseTo(5);
      expect(point[1]).toBeCloseTo(5);
    });

    it('should handle negative coordinates', () => {
      const line = new LineCurve([-10, -20], [10, 20]);
      const point = line.getPoint(0.5);
      expect(point[0]).toBeCloseTo(0);
      expect(point[1]).toBeCloseTo(0);
    });
  });

  describe('getLength', () => {
    it('should calculate horizontal line length correctly', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      expect(line.getLength()).toBeCloseTo(10);
    });

    it('should calculate vertical line length correctly', () => {
      const line = new LineCurve([0, 0], [0, 10]);
      expect(line.getLength()).toBeCloseTo(10);
    });

    it('should calculate diagonal line length correctly', () => {
      const line = new LineCurve([0, 0], [3, 4]);
      expect(line.getLength()).toBeCloseTo(5);
    });

    it('should return 0 for zero-length line', () => {
      const line = new LineCurve([5, 5], [5, 5]);
      expect(line.getLength()).toBeCloseTo(0);
    });

    it('should handle Pythagorean triples', () => {
      const line = new LineCurve([0, 0], [5, 12]);
      expect(line.getLength()).toBeCloseTo(13);
    });
  });

  describe('getPointAt', () => {
    it('should return start point when u=0', () => {
      const line = new LineCurve([0, 0], [10, 10]);
      const point = line.getPointAt(0);
      expect(point[0]).toBeCloseTo(0);
      expect(point[1]).toBeCloseTo(0);
    });

    it('should return end point when u=1', () => {
      const line = new LineCurve([0, 0], [10, 10]);
      const point = line.getPointAt(1);
      expect(point[0]).toBeCloseTo(10);
      expect(point[1]).toBeCloseTo(10);
    });

    it('should return equidistant point for linear curve', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const point = line.getPointAt(0.5);
      expect(point[0]).toBeCloseTo(5);
      expect(point[1]).toBeCloseTo(0);
    });
  });

  describe('getPoints', () => {
    it('should return correct number of points', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const points = line.getPoints(4);
      expect(points).toHaveLength(5); // divisions + 1
    });

    it('should include start and end points', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const points = line.getPoints(2);
      expect(points[0][0]).toBeCloseTo(0);
      expect(points[2][0]).toBeCloseTo(10);
    });

    it('should space points evenly', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const points = line.getPoints(4);
      expect(points[0][0]).toBeCloseTo(0);
      expect(points[1][0]).toBeCloseTo(2.5);
      expect(points[2][0]).toBeCloseTo(5);
      expect(points[3][0]).toBeCloseTo(7.5);
      expect(points[4][0]).toBeCloseTo(10);
    });
  });

  describe('getSpacedPoints', () => {
    it('should return equidistant points for line', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const points = line.getSpacedPoints(4);
      expect(points).toHaveLength(5);
      expect(points[0][0]).toBeCloseTo(0);
      expect(points[4][0]).toBeCloseTo(10);
    });
  });

  describe('getTangent', () => {
    it('should return unit tangent for horizontal line', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const tangent = line.getTangent(0.5);
      expect(tangent[0]).toBeCloseTo(1);
      expect(tangent[1]).toBeCloseTo(0);
    });

    it('should return unit tangent for vertical line', () => {
      const line = new LineCurve([0, 0], [0, 10]);
      const tangent = line.getTangent(0.5);
      expect(tangent[0]).toBeCloseTo(0);
      expect(tangent[1]).toBeCloseTo(1);
    });

    it('should return normalized tangent for diagonal line', () => {
      const line = new LineCurve([0, 0], [10, 10]);
      const tangent = line.getTangent(0.5);
      const length = Math.sqrt(tangent[0] ** 2 + tangent[1] ** 2);
      expect(length).toBeCloseTo(1);
      expect(Math.abs(tangent[0])).toBeCloseTo(Math.abs(tangent[1]));
    });

    it('should return consistent tangent across the line', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const t1 = line.getTangent(0.1);
      const t2 = line.getTangent(0.5);
      const t3 = line.getTangent(0.9);
      expect(t1[0]).toBeCloseTo(t2[0]);
      expect(t2[0]).toBeCloseTo(t3[0]);
    });

    it('should handle boundary values', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const tangentStart = line.getTangent(0);
      const tangentEnd = line.getTangent(1);
      expect(tangentStart[0]).toBeCloseTo(1);
      expect(tangentEnd[0]).toBeCloseTo(1);
    });
  });

  describe('getTangentAt', () => {
    it('should return tangent at parametric position', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const tangent = line.getTangentAt(0.5);
      expect(tangent[0]).toBeCloseTo(1);
      expect(tangent[1]).toBeCloseTo(0);
    });
  });

  describe('arcLengthDivisions', () => {
    it('should respect custom arcLengthDivisions', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      line.arcLengthDivisions = 10;
      const lengths = line.getLengths();
      expect(lengths).toHaveLength(11); // divisions + 1
    });

    it('should cache arc lengths', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const lengths1 = line.getLengths();
      const lengths2 = line.getLengths();
      expect(lengths1).toBe(lengths2);
    });

    it('should invalidate cache when updateArcLengths is called', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const lengths1 = line.getLengths();
      line.updateArcLengths();
      const lengths2 = line.getLengths();
      expect(lengths1).not.toBe(lengths2);
      expect(lengths1).toEqual(lengths2);
    });
  });

  describe('getLengths', () => {
    it('should start with 0', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const lengths = line.getLengths();
      expect(lengths[0]).toBeCloseTo(0);
    });

    it('should end with total length', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      const lengths = line.getLengths();
      expect(lengths[lengths.length - 1]).toBeCloseTo(10);
    });

    it('should be monotonically increasing', () => {
      const line = new LineCurve([0, 0], [10, 10]);
      const lengths = line.getLengths(10);
      for (let i = 1; i < lengths.length; i++) {
        expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
      }
    });
  });

  describe('clone and copy', () => {
    it('should clone with same arcLengthDivisions', () => {
      const line = new LineCurve([0, 0], [10, 0]);
      line.arcLengthDivisions = 50;
      const cloned = line.clone();
      expect(cloned.arcLengthDivisions).toBe(50);
    });

    it('should copy arcLengthDivisions from source', () => {
      const line1 = new LineCurve([0, 0], [10, 0]);
      line1.arcLengthDivisions = 100;
      const line2 = new LineCurve([5, 5], [15, 15]);
      line2.copy(line1);
      expect(line2.arcLengthDivisions).toBe(100);
    });
  });
});
