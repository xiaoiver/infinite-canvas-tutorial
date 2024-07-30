import { Ellipse } from '../../packages/core/src';

describe('Ellipse', () => {
  it('should get/set attributes correctly.', () => {
    const ellipse = new Ellipse({
      cx: 50,
      cy: 50,
      rx: 50,
      ry: 50,
      fill: '#F67676',
    });
    expect(ellipse.cx).toBe(50);
    expect(ellipse.cy).toBe(50);
    expect(ellipse.rx).toBe(50);
    expect(ellipse.ry).toBe(50);
    expect(ellipse.fill).toBe('#F67676');
    expect(ellipse.fillRGB).toEqual({ b: 118, g: 118, opacity: 1, r: 246 });

    const defaultEllipse = new Ellipse();
    expect(defaultEllipse.cx).toBe(0);
    expect(defaultEllipse.cy).toBe(0);
    expect(defaultEllipse.rx).toBe(0);
    expect(defaultEllipse.ry).toBe(0);
    expect(defaultEllipse.fill).toBe('black');
    expect(defaultEllipse.fillRGB).toEqual({
      b: 0,
      g: 0,
      opacity: 1,
      r: 0,
    });
  });

  it('should account for pointerEvents when checking containPoints.', () => {
    const ellipse = new Ellipse({
      cx: 50,
      cy: 50,
      rx: 50,
      ry: 50,
      fill: '#F67676',
      stroke: 'black',
      strokeWidth: 10,
    });

    expect(ellipse.containsPoint(0, 0)).toBe(false);
    expect(ellipse.containsPoint(50, 50)).toBe(true);
    expect(ellipse.containsPoint(100, 100)).toBe(false);

    ellipse.pointerEvents = 'none';
    expect(ellipse.containsPoint(50, 50)).toBe(false);

    ellipse.pointerEvents = 'stroke';
    // expect(ellipse.containsPoint(50, 6)).toBe(false);
    // expect(ellipse.containsPoint(50, 5)).toBe(true);
    // expect(ellipse.containsPoint(50, -5)).toBe(true);
    // expect(ellipse.containsPoint(50, -6)).toBe(false);
    // expect(ellipse.containsPoint(100, 50)).toBe(true);
    // expect(ellipse.containsPoint(50, 50)).toBe(false);

    ellipse.pointerEvents = 'fill';
    expect(ellipse.containsPoint(50, -5)).toBe(false);
    expect(ellipse.containsPoint(50, 0)).toBe(true);
  });

  it('should calculate geometry & render bounds correctly.', () => {
    const ellipse = new Ellipse({
      cx: 50,
      cy: 50,
      rx: 50,
      ry: 50,
      fill: '#F67676',
      stroke: 'black',
      strokeWidth: 10,
    });
    let bounds = ellipse.getGeometryBounds();
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(100);
    expect(bounds.maxY).toEqual(100);

    bounds = ellipse.getGeometryBounds();
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(100);
    expect(bounds.maxY).toEqual(100);

    bounds = ellipse.getRenderBounds();
    expect(bounds.minX).toEqual(-5);
    expect(bounds.minY).toEqual(-5);
    expect(bounds.maxX).toEqual(105);
    expect(bounds.maxY).toEqual(105);
  });
});
