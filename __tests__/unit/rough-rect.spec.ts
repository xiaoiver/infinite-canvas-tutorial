import { RoughRect } from '../../packages/core/src';

describe('Rough Rect', () => {
  it('should get/set attributes correctly.', () => {
    const rect = new RoughRect({
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      fill: '#F67676',
    });
    expect(rect.x).toBe(50);
    expect(rect.y).toBe(50);
    expect(rect.width).toBe(50);
    expect(rect.height).toBe(50);
    expect(rect.fill).toBe('#F67676');
    expect(rect.fillRGB).toEqual({ b: 118, g: 118, opacity: 1, r: 246 });

    const defaultRect = new RoughRect();
    expect(defaultRect.x).toBe(0);
    expect(defaultRect.y).toBe(0);
    expect(defaultRect.width).toBe(0);
    expect(defaultRect.height).toBe(0);
    expect(defaultRect.cornerRadius).toBe(0);
    expect(defaultRect.fill).toBe('black');
    expect(defaultRect.fillRGB).toEqual({
      b: 0,
      g: 0,
      opacity: 1,
      r: 0,
    });
    expect(defaultRect.dropShadowBlurRadius).toBe(0);
    expect(defaultRect.dropShadowColor).toBe('black');
    expect(defaultRect.dropShadowColorRGB).toEqual({
      b: 0,
      g: 0,
      opacity: 1,
      r: 0,
    });
    expect(defaultRect.dropShadowOffsetX).toBe(0);
    expect(defaultRect.dropShadowOffsetY).toBe(0);
  });

  it('should account for pointerEvents when checking containPoints.', () => {
    const rect = new RoughRect({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: '#F67676',
      stroke: 'black',
      strokeWidth: 10,
    });

    expect(rect.containsPoint(-10, -10)).toBe(false);
    expect(rect.containsPoint(0, 0)).toBe(true);
    expect(rect.containsPoint(50, 50)).toBe(true);
    expect(rect.containsPoint(100, 100)).toBe(true);
    expect(rect.containsPoint(110, 110)).toBe(false);

    rect.pointerEvents = 'none';
    expect(rect.containsPoint(50, 50)).toBe(false);

    rect.pointerEvents = 'stroke';
    expect(rect.containsPoint(50, 50)).toBe(false);
    expect(rect.containsPoint(-5, -5)).toBe(true);
    expect(rect.containsPoint(0, 0)).toBe(true);
    expect(rect.containsPoint(100, 100)).toBe(true);
    expect(rect.containsPoint(105, 105)).toBe(true);

    rect.pointerEvents = 'fill';
    expect(rect.containsPoint(50, 50)).toBe(true);
    expect(rect.containsPoint(-5, -5)).toBe(false);
    expect(rect.containsPoint(0, 0)).toBe(true);
    expect(rect.containsPoint(100, 100)).toBe(true);
    expect(rect.containsPoint(105, 105)).toBe(false);
  });

  it('should calculate geometry & render bounds correctly.', () => {
    const rect = new RoughRect({
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      fill: '#F67676',
      stroke: 'black',
      strokeWidth: 10,
    });
    let bounds = rect.getGeometryBounds();
    expect(bounds.minX).toEqual(50);
    expect(bounds.minY).toEqual(50);
    expect(bounds.maxX).toEqual(100);
    expect(bounds.maxY).toEqual(100);

    bounds = rect.getGeometryBounds();
    expect(bounds.minX).toEqual(50);
    expect(bounds.minY).toEqual(50);
    expect(bounds.maxX).toEqual(100);
    expect(bounds.maxY).toEqual(100);

    bounds = RoughRect.getGeometryBounds({});
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(0);
    expect(bounds.maxY).toEqual(0);

    bounds = rect.getRenderBounds();
    expect(bounds.minX).toEqual(45);
    expect(bounds.minY).toEqual(45);
    expect(bounds.maxX).toEqual(105);
    expect(bounds.maxY).toEqual(105);
  });
});
