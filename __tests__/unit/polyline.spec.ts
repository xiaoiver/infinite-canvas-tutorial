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

  // it('should account for pointerEvents when checking containPoints.', () => {
  //   const circle = new Circle({
  //     cx: 50,
  //     cy: 50,
  //     r: 50,
  //     fill: '#F67676',
  //     stroke: 'black',
  //     strokeWidth: 10,
  //   });

  //   expect(circle.containsPoint(0, 0)).toBe(false);
  //   expect(circle.containsPoint(50, 50)).toBe(true);
  //   expect(circle.containsPoint(100, 100)).toBe(false);

  //   circle.pointerEvents = 'none';
  //   expect(circle.containsPoint(50, 50)).toBe(false);

  //   circle.pointerEvents = 'stroke';
  //   expect(circle.containsPoint(50, 6)).toBe(false);
  //   expect(circle.containsPoint(50, 5)).toBe(true);
  //   expect(circle.containsPoint(50, -5)).toBe(true);
  //   expect(circle.containsPoint(50, -6)).toBe(false);
  //   expect(circle.containsPoint(100, 50)).toBe(true);
  //   expect(circle.containsPoint(50, 50)).toBe(false);

  //   circle.pointerEvents = 'fill';
  //   expect(circle.containsPoint(50, -5)).toBe(false);
  //   expect(circle.containsPoint(50, 0)).toBe(true);
  // });

  // it('should calculate geometry & render bounds correctly.', () => {
  //   const circle = new Circle({
  //     cx: 50,
  //     cy: 50,
  //     r: 50,
  //     fill: '#F67676',
  //     stroke: 'black',
  //     strokeWidth: 10,
  //   });
  //   let bounds = circle.getGeometryBounds();
  //   expect(bounds.minX).toEqual(0);
  //   expect(bounds.minY).toEqual(0);
  //   expect(bounds.maxX).toEqual(100);
  //   expect(bounds.maxY).toEqual(100);

  //   bounds = circle.getGeometryBounds();
  //   expect(bounds.minX).toEqual(0);
  //   expect(bounds.minY).toEqual(0);
  //   expect(bounds.maxX).toEqual(100);
  //   expect(bounds.maxY).toEqual(100);

  //   bounds = Circle.getGeometryBounds({});
  //   expect(bounds.minX).toEqual(0);
  //   expect(bounds.minY).toEqual(0);
  //   expect(bounds.maxX).toEqual(0);
  //   expect(bounds.maxY).toEqual(0);

  //   bounds = circle.getRenderBounds();
  //   expect(bounds.minX).toEqual(-5);
  //   expect(bounds.minY).toEqual(-5);
  //   expect(bounds.maxX).toEqual(105);
  //   expect(bounds.maxY).toEqual(105);
  // });
});
