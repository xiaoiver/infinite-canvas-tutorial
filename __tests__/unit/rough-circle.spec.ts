import { RoughCircle } from '../../packages/core/src';

describe('Rough Circle', () => {
  it('should get/set attributes correctly.', () => {
    const circle = new RoughCircle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: '#F67676',
    });
    expect(circle.cx).toBe(50);
    expect(circle.cy).toBe(50);
    expect(circle.r).toBe(50);
    expect(circle.fill).toBe('#F67676');
    expect(circle.fillRGB).toEqual({ b: 118, g: 118, opacity: 1, r: 246 });

    const defaultCircle = new RoughCircle();
    expect(defaultCircle.cx).toBe(0);
    expect(defaultCircle.cy).toBe(0);
    expect(defaultCircle.r).toBe(0);
    expect(defaultCircle.fill).toBe('black');
    expect(defaultCircle.fillRGB).toEqual({
      b: 0,
      g: 0,
      opacity: 1,
      r: 0,
    });
  });

  it('should account for pointerEvents when checking containPoints.', () => {
    const circle = new RoughCircle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: '#F67676',
      stroke: 'black',
      strokeWidth: 10,
    });

    expect(circle.containsPoint(0, 0)).toBe(false);
    expect(circle.containsPoint(50, 50)).toBe(true);
    expect(circle.containsPoint(100, 100)).toBe(false);

    circle.pointerEvents = 'none';
    expect(circle.containsPoint(50, 50)).toBe(false);

    circle.pointerEvents = 'stroke';
    expect(circle.containsPoint(50, 6)).toBe(false);
    expect(circle.containsPoint(50, 5)).toBe(true);
    expect(circle.containsPoint(50, -5)).toBe(true);
    expect(circle.containsPoint(50, -6)).toBe(false);
    expect(circle.containsPoint(100, 50)).toBe(true);
    expect(circle.containsPoint(50, 50)).toBe(false);

    circle.pointerEvents = 'fill';
    expect(circle.containsPoint(50, -5)).toBe(false);
    expect(circle.containsPoint(50, 0)).toBe(true);
  });

  it('should calculate geometry & render bounds correctly.', () => {
    const circle = new RoughCircle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: '#F67676',
      stroke: 'black',
      strokeWidth: 10,
    });
    let bounds = circle.getGeometryBounds();
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(100);
    expect(bounds.maxY).toEqual(100);

    bounds = circle.getGeometryBounds();
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(100);
    expect(bounds.maxY).toEqual(100);

    bounds = RoughCircle.getGeometryBounds({});
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(0);
    expect(bounds.maxY).toEqual(0);

    bounds = circle.getRenderBounds();
    expect(bounds.minX).toEqual(-5);
    expect(bounds.minY).toEqual(-5);
    expect(bounds.maxX).toEqual(105);
    expect(bounds.maxY).toEqual(105);

    circle.cx = 100;
    bounds = circle.getGeometryBounds();
    expect(bounds.minX).toEqual(50);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(150);
    expect(bounds.maxY).toEqual(100);
  });
});
