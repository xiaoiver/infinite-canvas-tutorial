import { Polyline } from '../../packages/core/src';

describe('Polyline', () => {
  it('should get/set attributes correctly.', () => {
    const polyline = new Polyline({
      points: [
        [0, 0],
        [100, 100],
      ],
      stroke: '#F67676',
    });

    expect(polyline.points).toEqual([
      [0, 0],
      [100, 100],
    ]);
    expect(polyline.strokeWidth).toBe(1);
    expect(polyline.stroke).toBe('#F67676');
    expect(polyline.strokeRGB).toEqual({ b: 118, g: 118, opacity: 1, r: 246 });

    polyline.points = [
      [100, 0],
      [100, 100],
    ];
    expect(polyline.points).toEqual([
      [100, 0],
      [100, 100],
    ]);

    const defaultPolyline = new Polyline();
    expect(defaultPolyline.fill).toBe('black');
    expect(defaultPolyline.fillRGB).toEqual({
      b: 0,
      g: 0,
      opacity: 1,
      r: 0,
    });
    expect(defaultPolyline.strokeLinecap).toBe('butt');
    expect(defaultPolyline.strokeLinejoin).toBe('miter');
    expect(defaultPolyline.strokeAlignment).toBe('center');
    expect(defaultPolyline.strokeMiterlimit).toBe(4);
    expect(defaultPolyline.strokeDasharray).toEqual([]);
    expect(defaultPolyline.strokeDashoffset).toBe(0);
  });

  it('should account for pointerEvents when checking containPoints.', () => {
    const polyline = new Polyline({
      points: [
        [0, 0],
        [100, 100],
      ],
      stroke: '#F67676',
    });

    expect(polyline.containsPoint(0, 0)).toBe(true);
    expect(polyline.containsPoint(50, 50)).toBe(true);
    expect(polyline.containsPoint(100, 100)).toBe(true);
    expect(polyline.containsPoint(200, 200)).toBe(false);

    polyline.pointerEvents = 'none';
    expect(polyline.containsPoint(0, 0)).toBe(false);
    expect(polyline.containsPoint(50, 50)).toBe(false);
    expect(polyline.containsPoint(100, 100)).toBe(false);

    polyline.pointerEvents = 'stroke';
    expect(polyline.containsPoint(0, 0)).toBe(true);
    expect(polyline.containsPoint(50, 50)).toBe(true);
    expect(polyline.containsPoint(100, 100)).toBe(true);
    expect(polyline.containsPoint(200, 200)).toBe(false);
  });

  it('should calculate geometry & render bounds correctly.', () => {
    const polyline = new Polyline({
      points: [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
      stroke: '#F67676',
      fill: 'none',
      strokeWidth: 20,
    });
    let bounds = polyline.getGeometryBounds();
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(100);
    expect(bounds.maxY).toEqual(100);

    bounds = Polyline.getGeometryBounds({});
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(0);
    expect(bounds.maxY).toEqual(0);

    bounds = polyline.getRenderBounds();
    expect(bounds.minX).toEqual(-10);
    expect(bounds.minY).toEqual(-10);
    expect(bounds.maxX).toEqual(110);
    expect(bounds.maxY).toEqual(110);

    polyline.strokeAlignment = 'inner';
    bounds = polyline.getGeometryBounds();
    expect(bounds.minX).toBeCloseTo(0);
    expect(bounds.minY).toEqual(10);
    expect(bounds.maxX).toEqual(90);
    expect(bounds.maxY).toEqual(100);

    polyline.strokeAlignment = 'outer';
    bounds = polyline.getGeometryBounds();
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(-10);
    expect(bounds.maxX).toEqual(110);
    expect(bounds.maxY).toEqual(100);
  });

  it('should calculate shifted points correctly.', () => {
    const polyline = new Polyline({
      points: [
        [0, 0],
        [100, 0],
      ],
      stroke: '#F67676',
      fill: 'none',
      strokeWidth: 20,
    });

    expect(polyline.getTotalLength()).toEqual(100);
  });
});
