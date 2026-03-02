import {
  CurvePath,
  LineCurve,
  QuadraticBezierCurve,
  CubicBezierCurve,
  EllipseCurve,
} from '../../packages/ecs/src/utils/curve';
import { Path } from '../../packages/ecs/src/utils/curve/path';

describe('CurvePath', () => {
  describe('add', () => {
    it('should add curves to the path', () => {
      const path = new CurvePath();
      const line = new LineCurve([0, 0], [10, 0]);

      path.add(line);

      expect(path.curves).toHaveLength(1);
      expect(path.curves[0]).toBe(line);
    });

    it('should add multiple curves', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));
      path.add(new LineCurve([10, 0], [10, 10]));
      path.add(new LineCurve([10, 10], [0, 10]));

      expect(path.curves).toHaveLength(3);
    });
  });

  describe('closePath', () => {
    it('should add line to close open path', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));
      path.add(new LineCurve([10, 0], [10, 10]));

      path.closePath();

      expect(path.curves).toHaveLength(3);
      const lastCurve = path.curves[2] as LineCurve;
      const endPoint = lastCurve.getPoint(1);
      expect(endPoint[0]).toBeCloseTo(0);
      expect(endPoint[1]).toBeCloseTo(0);
    });

    it('should not add line if path is already closed', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));
      path.add(new LineCurve([10, 0], [0, 0])); // Returns to start

      path.closePath();

      expect(path.curves).toHaveLength(2);
    });

    it('should return the path for chaining', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));

      const result = path.closePath();

      expect(result).toBe(path);
    });
  });

  describe('getLength', () => {
    it('should return sum of all curve lengths', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0])); // length 10
      path.add(new LineCurve([10, 0], [10, 10])); // length 10

      expect(path.getLength()).toBeCloseTo(20);
    });

    it('should return 0 for empty path', () => {
      const path = new Path();
      expect(path.getLength()).toBe(undefined);
    });

    it('should handle mixed curve types', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));
      path.add(new EllipseCurve(10, 5, 5, 5, -Math.PI / 2, Math.PI / 2));

      const length = path.getLength();
      expect(length).toBeGreaterThan(10); // More than just the line
    });
  });

  describe('getPoint', () => {
    it('should get point at t=0', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));
      path.add(new LineCurve([10, 0], [10, 10]));

      const point = path.getPoint(0);
      expect(point?.[0]).toBeCloseTo(0);
      expect(point?.[1]).toBeCloseTo(0);
    });

    it('should get point at t=1', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));
      path.add(new LineCurve([10, 0], [10, 10]));

      const point = path.getPoint(1);
      expect(point?.[0]).toBeCloseTo(10);
      expect(point?.[1]).toBeCloseTo(10);
    });

    it('should get point at t=0.5 for equal length curves', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0])); // length 10
      path.add(new LineCurve([10, 0], [20, 0])); // length 10

      const point = path.getPoint(0.5);
      expect(point?.[0]).toBeCloseTo(10);
      expect(point?.[1]).toBeCloseTo(0);
    });

    it('should handle unequal curve lengths correctly', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0])); // length 10
      path.add(new LineCurve([10, 0], [10, 5])); // length 5

      // At t=2/3, should be at end of first curve
      const point = path.getPoint(2 / 3);
      expect(point?.[0]).toBeCloseTo(10);
      expect(point?.[1]).toBeCloseTo(0);
    });

    it('should return null for empty path', () => {
      const path = new CurvePath();
      const point = path.getPoint(0.5);
      expect(point).toBeNull();
    });
  });

  describe('getPoints', () => {
    it('should return points from all curves', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));
      path.add(new LineCurve([10, 0], [10, 10]));

      const points = path.getPoints(1);
      expect(points.length).toBeGreaterThan(2);
    });

    it('should filter duplicate consecutive points', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));
      path.add(new LineCurve([10, 0], [10, 10]));

      const points = path.getPoints(4);
      // Check that no two consecutive points are the same
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const isSame = prev[0] === curr[0] && prev[1] === curr[1];
        expect(isSame).toBe(false);
      }
    });

    it('should close path with autoClose', () => {
      const path = new CurvePath();
      path.autoClose = true;
      path.add(new LineCurve([0, 0], [10, 0]));
      path.add(new LineCurve([10, 0], [10, 10]));
      path.add(new LineCurve([10, 10], [0, 10]));

      const points = path.getPoints(1);
      const first = points[0];
      const last = points[points.length - 1];

      expect(first[0]).toBeCloseTo(last[0]);
      expect(first[1]).toBeCloseTo(last[1]);
    });

    it('should use higher resolution for ellipses', () => {
      const path = new CurvePath();
      path.add(new EllipseCurve(0, 0, 5, 5, 0, Math.PI * 2));

      const points = path.getPoints(4);
      // Ellipse curves get 2x divisions
      expect(points.length).toBeGreaterThan(4);
    });

    it('should use resolution of 1 for lines', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));
      path.add(new LineCurve([10, 0], [20, 0]));

      const points = path.getPoints(4);
      // Line curves only get 1 division
      expect(points.length).toBe(3); // 2 points per line, but one is shared
    });
  });

  describe('getCurveLengths', () => {
    it('should cache curve lengths', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));

      const lengths1 = path.getCurveLengths();
      const lengths2 = path.getCurveLengths();

      expect(lengths1).toBe(lengths2);
    });

    it('should recalculate when curves change', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));

      const lengths1 = path.getCurveLengths();
      path.add(new LineCurve([10, 0], [20, 0]));
      const lengths2 = path.getCurveLengths();

      expect(lengths1).not.toBe(lengths2);
      expect(lengths2).toHaveLength(2);
    });

    it('should return cumulative lengths', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0])); // length 10
      path.add(new LineCurve([10, 0], [10, 10])); // length 10

      const lengths = path.getCurveLengths();
      expect(lengths).toHaveLength(2);
      expect(lengths[0]).toBeCloseTo(10);
      expect(lengths[1]).toBeCloseTo(20);
    });
  });

  describe('updateArcLengths', () => {
    it('should invalidate cache', () => {
      const path = new CurvePath();
      path.add(new LineCurve([0, 0], [10, 0]));

      const lengths1 = path.getCurveLengths();
      path.updateArcLengths();
      const lengths2 = path.getCurveLengths();

      expect(lengths1).not.toBe(lengths2);
    });
  });
});

describe('Path', () => {
  describe('constructor', () => {
    it('should create empty path', () => {
      const path = new Path();
      expect(path.curves).toHaveLength(0);
      expect(path.currentPoint[0]).toBe(0);
      expect(path.currentPoint[1]).toBe(0);
    });

    it('should create path from points', () => {
      const path = new Path([
        [0, 0],
        [10, 0],
        [10, 10],
      ]);
      expect(path.curves).toHaveLength(2);
    });
  });

  describe('setFromPoints', () => {
    it('should create polyline from points', () => {
      const path = new Path();
      path.setFromPoints([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ]);

      expect(path.curves).toHaveLength(3);

      const endPoint = path.getPoint(1);
      expect(endPoint?.[0]).toBeCloseTo(0);
      expect(endPoint?.[1]).toBeCloseTo(10);
    });
  });

  describe('moveTo', () => {
    it('should set current point', () => {
      const path = new Path();
      path.moveTo(100, 200);

      expect(path.currentPoint[0]).toBe(100);
      expect(path.currentPoint[1]).toBe(200);
    });

    it('should return path for chaining', () => {
      const path = new Path();
      const result = path.moveTo(0, 0);
      expect(result).toBe(path);
    });
  });

  describe('lineTo', () => {
    it('should add line curve from current point', () => {
      const path = new Path();
      path.moveTo(0, 0);
      path.lineTo(10, 10);

      expect(path.curves).toHaveLength(1);

      const line = path.curves[0] as LineCurve;
      const start = line.getPoint(0);
      const end = line.getPoint(1);

      expect(start[0]).toBe(0);
      expect(start[1]).toBe(0);
      expect(end[0]).toBe(10);
      expect(end[1]).toBe(10);
    });

    it('should update current point', () => {
      const path = new Path();
      path.moveTo(0, 0);
      path.lineTo(10, 10);

      expect(path.currentPoint[0]).toBe(10);
      expect(path.currentPoint[1]).toBe(10);
    });

    it('should chain multiple lineTo calls', () => {
      const path = new Path();
      path
        .moveTo(0, 0)
        .lineTo(10, 0)
        .lineTo(10, 10)
        .lineTo(0, 10);

      expect(path.curves).toHaveLength(3);
      expect(path.currentPoint[0]).toBe(0);
      expect(path.currentPoint[1]).toBe(10);
    });
  });

  describe('quadraticCurveTo', () => {
    it('should add quadratic bezier curve', () => {
      const path = new Path();
      path.moveTo(0, 0);
      path.quadraticCurveTo(5, 10, 10, 0);

      expect(path.curves).toHaveLength(1);
      expect(path.curves[0]).toBeInstanceOf(QuadraticBezierCurve);
    });

    it('should update current point to end point', () => {
      const path = new Path();
      path.moveTo(0, 0);
      path.quadraticCurveTo(5, 10, 10, 5);

      expect(path.currentPoint[0]).toBe(10);
      expect(path.currentPoint[1]).toBe(5);
    });

    it('should start from current point', () => {
      const path = new Path();
      path.moveTo(5, 5);
      path.quadraticCurveTo(10, 15, 15, 5);

      const curve = path.curves[0] as QuadraticBezierCurve;
      const start = curve.getPoint(0);
      expect(start[0]).toBe(5);
      expect(start[1]).toBe(5);
    });
  });

  describe('bezierCurveTo', () => {
    it('should add cubic bezier curve', () => {
      const path = new Path();
      path.moveTo(0, 0);
      path.bezierCurveTo(0, 5, 10, 5, 10, 0);

      expect(path.curves).toHaveLength(1);
      expect(path.curves[0]).toBeInstanceOf(CubicBezierCurve);
    });

    it('should update current point to end point', () => {
      const path = new Path();
      path.moveTo(0, 0);
      path.bezierCurveTo(0, 5, 10, 5, 10, 10);

      expect(path.currentPoint[0]).toBe(10);
      expect(path.currentPoint[1]).toBe(10);
    });
  });

  describe('absarc', () => {
    it('should add circular arc with absolute coordinates', () => {
      const path = new Path();
      path.moveTo(15, 0);
      path.absarc(10, 0, 5, 0, Math.PI, false);

      expect(path.curves).toHaveLength(1);
      expect(path.curves[0]).toBeInstanceOf(EllipseCurve);

      const end = path.getPoint(1);
      expect(end?.[0]).toBeCloseTo(5);
      expect(end?.[1]).toBeCloseTo(0, 10);
    });

    it('should connect to arc start if not already there', () => {
      const path = new Path();
      path.moveTo(0, 0);
      path.absarc(10, 0, 5, 0, Math.PI, false);

      // Should add a line to connect to arc start
      expect(path.curves).toHaveLength(1);
      expect(path.curves[0]).toBeInstanceOf(EllipseCurve);
    });

    it('should update current point to arc end', () => {
      const path = new Path();
      path.moveTo(15, 0);
      path.absarc(10, 0, 5, 0, Math.PI / 2, false);

      expect(path.currentPoint[0]).toBeCloseTo(10, 10);
      expect(path.currentPoint[1]).toBeCloseTo(5);
    });
  });

  describe('absellipse', () => {
    it('should add elliptical arc', () => {
      const path = new Path();
      path.moveTo(20, 0);
      path.absellipse(10, 0, 10, 5, 0, Math.PI * 2, false);

      expect(path.curves).toHaveLength(1);
      expect(path.curves[0]).toBeInstanceOf(EllipseCurve);
    });

    it('should handle rotation parameter', () => {
      const path = new Path();
      path.moveTo(20, 0);
      path.absellipse(10, 0, 10, 5, 0, Math.PI * 2, false, Math.PI / 4);

      const ellipse = path.curves[0] as EllipseCurve;
      expect(ellipse.aRotation).toBe(Math.PI / 4);
    });
  });

  describe('arc', () => {
    it('should add arc relative to current point', () => {
      const path = new Path();
      path.moveTo(5, 5);
      // Arc centered at (15, 5) relative to current (5,5) means absolute center is (20, 10)
      path.arc(15, 5, 5, 0, Math.PI, false);

      expect(path.curves).toHaveLength(1);
      expect(path.curves[0]).toBeInstanceOf(EllipseCurve);
    });
  });

  describe('complex paths', () => {
    it('should create rounded rectangle', () => {
      const path = new Path();
      const width = 100;
      const height = 50;
      const radius = 10;

      path
        .moveTo(radius, 0)
        .lineTo(width - radius, 0)
        .absarc(width - radius, radius, radius, -Math.PI / 2, 0, false)
        .lineTo(width, height - radius)
        .absarc(width - radius, height - radius, radius, 0, Math.PI / 2, false)
        .lineTo(radius, height)
        .absarc(radius, height - radius, radius, Math.PI / 2, Math.PI, false)
        .lineTo(0, radius)
        .absarc(radius, radius, radius, Math.PI, Math.PI * 1.5, false)
        .closePath();

      expect(path.curves.length).toBeGreaterThan(4);
      expect(path.getLength()).toBeGreaterThan(282);
    });

    it('should create heart shape using bezier curves', () => {
      const path = new Path();
      const x = 0;
      const y = 0;
      const size = 50;

      path
        .moveTo(x, y + size / 4)
        .bezierCurveTo(
          x, y,
          x - size / 2, y,
          x - size / 2, y + size / 4
        )
        .bezierCurveTo(
          x - size / 2, y + size / 2,
          x, y + size * 3 / 4,
          x, y + size
        )
        .bezierCurveTo(
          x, y + size * 3 / 4,
          x + size / 2, y + size / 2,
          x + size / 2, y + size / 4
        )
        .bezierCurveTo(
          x + size / 2, y,
          x, y,
          x, y + size / 4
        );

      expect(path.curves).toHaveLength(4);
      expect(path.curves.every(c => c instanceof CubicBezierCurve)).toBe(true);
    });
  });
});

describe('QuadraticBezierCurve', () => {
  describe('getPoint', () => {
    it('should return start point at t=0', () => {
      const curve = new QuadraticBezierCurve([0, 0], [5, 10], [10, 0]);
      const point = curve.getPoint(0);
      expect(point[0]).toBeCloseTo(0);
      expect(point[1]).toBeCloseTo(0);
    });

    it('should return end point at t=1', () => {
      const curve = new QuadraticBezierCurve([0, 0], [5, 10], [10, 0]);
      const point = curve.getPoint(1);
      expect(point[0]).toBeCloseTo(10);
      expect(point[1]).toBeCloseTo(0);
    });

    it('should return control point influence at t=0.5', () => {
      const curve = new QuadraticBezierCurve([0, 0], [5, 10], [10, 0]);
      const point = curve.getPoint(0.5);
      // At t=0.5, quadratic bezier is at (2.5, 5) + influence from control point
      expect(point[0]).toBeCloseTo(5);
      expect(point[1]).toBeCloseTo(5);
    });

    it('should form parabola with symmetric control points', () => {
      const curve = new QuadraticBezierCurve([0, 0], [5, 10], [10, 0]);
      const p1 = curve.getPoint(0.25);
      const p2 = curve.getPoint(0.75);
      expect(p1[1]).toBeCloseTo(p2[1], 1);
    });
  });

  describe('getLength', () => {
    it('should calculate length for straight line equivalent', () => {
      // Control point at midpoint creates straight line
      const curve = new QuadraticBezierCurve([0, 0], [5, 0], [10, 0]);
      expect(curve.getLength()).toBeCloseTo(10, 0);
    });

    it('should be longer than straight line for curved bezier', () => {
      const straight = new LineCurve([0, 0], [10, 0]);
      const curved = new QuadraticBezierCurve([0, 0], [5, 10], [10, 0]);

      expect(curved.getLength()).toBeGreaterThan(straight.getLength());
    });
  });
});

describe('CubicBezierCurve', () => {
  describe('getPoint', () => {
    it('should return start point at t=0', () => {
      const curve = new CubicBezierCurve(
        [0, 0], [0, 5], [10, 5], [10, 0]
      );
      const point = curve.getPoint(0);
      expect(point[0]).toBeCloseTo(0);
      expect(point[1]).toBeCloseTo(0);
    });

    it('should return end point at t=1', () => {
      const curve = new CubicBezierCurve(
        [0, 0], [0, 5], [10, 5], [10, 0]
      );
      const point = curve.getPoint(1);
      expect(point[0]).toBeCloseTo(10);
      expect(point[1]).toBeCloseTo(0);
    });

    it('should interpolate with two control points', () => {
      const curve = new CubicBezierCurve(
        [0, 0], [0, 10], [10, 10], [10, 0]
      );
      const point = curve.getPoint(0.5);
      // With symmetric control points, midpoint should be at top
      expect(point[0]).toBeCloseTo(5);
      expect(point[1]).toBeCloseTo(7.5, 1);
    });
  });

  describe('getLength', () => {
    it('should calculate length for S-curve', () => {
      const curve = new CubicBezierCurve(
        [0, 0], [0, 10], [10, 0], [10, 10]
      );
      const length = curve.getLength();
      expect(length).toBeGreaterThan(10); // Longer than straight line
    });

    it('should match line length when control points are collinear', () => {
      const curve = new CubicBezierCurve(
        [0, 0], [3.33, 0], [6.67, 0], [10, 0]
      );
      expect(curve.getLength()).toBeCloseTo(10, 0);
    });
  });
});
