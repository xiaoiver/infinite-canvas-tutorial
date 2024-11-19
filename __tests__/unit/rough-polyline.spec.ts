import { RoughPolyline } from '../../packages/core/src';

describe('RoughPolyline', () => {
  it('should get/set attributes correctly.', () => {
    const polyline = new RoughPolyline({
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

    const defaultRoughPolyline = new RoughPolyline();
    expect(defaultRoughPolyline.fill).toBe('black');
    expect(defaultRoughPolyline.fillRGB).toEqual({
      b: 0,
      g: 0,
      opacity: 1,
      r: 0,
    });
    expect(defaultRoughPolyline.strokeLinecap).toBe('butt');
    expect(defaultRoughPolyline.strokeLinejoin).toBe('miter');
    expect(defaultRoughPolyline.strokeAlignment).toBe('center');
    expect(defaultRoughPolyline.strokeMiterlimit).toBe(4);
    expect(defaultRoughPolyline.strokeDasharray).toEqual([]);
    expect(defaultRoughPolyline.strokeDashoffset).toBe(0);
  });

  it('should account for pointerEvents when checking containPoints.', () => {
    const polyline = new RoughPolyline({
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
    const polyline = new RoughPolyline({
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

    bounds = RoughPolyline.getGeometryBounds({});
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

    /**
     * linecap = 'square'
     */
    polyline.strokeAlignment = 'center';
    polyline.strokeLinecap = 'square';
    bounds = polyline.getGeometryBounds();
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(100);
    expect(bounds.maxY).toEqual(100);
    bounds = polyline.getRenderBounds();
    expect(bounds.minX).toBeCloseTo(-14.142135623730951);
    expect(bounds.minY).toBeCloseTo(-14.142135623730951);
    expect(bounds.maxX).toBeCloseTo(114.14213562373095);
    expect(bounds.maxY).toBeCloseTo(114.14213562373095);

    /**
     * linecap = 'round'
     */
    polyline.strokeLinecap = 'round';
    bounds = polyline.getGeometryBounds();
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(100);
    expect(bounds.maxY).toEqual(100);
    bounds = polyline.getRenderBounds();
    expect(bounds.minX).toEqual(-10);
    expect(bounds.minY).toEqual(-10);
    expect(bounds.maxX).toEqual(110);
    expect(bounds.maxY).toEqual(110);
  });

  it('should calculate shifted points correctly.', () => {
    const polyline = new RoughPolyline({
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
