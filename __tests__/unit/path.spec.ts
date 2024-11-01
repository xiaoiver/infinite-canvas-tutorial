import { Path } from '../../packages/core/src';

describe('Path', () => {
  it('should get/set attributes correctly.', () => {
    const path = new Path({
      d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
      fill: '#F67676',
    });

    expect(path.fill).toBe('#F67676');
    expect(path.fillRGB).toEqual({ b: 118, g: 118, opacity: 1, r: 246 });
    expect(path.points).toEqual([
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
        [0, 0],
      ],
    ]);

    // const defaultRect = new Rect();
    // expect(defaultRect.x).toBe(0);
    // expect(defaultRect.y).toBe(0);
    // expect(defaultRect.width).toBe(0);
    // expect(defaultRect.height).toBe(0);
    // expect(defaultRect.cornerRadius).toBe(0);
    // expect(defaultRect.fill).toBe('black');
    // expect(defaultRect.fillRGB).toEqual({
    //   b: 0,
    //   g: 0,
    //   opacity: 1,
    //   r: 0,
    // });
    // expect(defaultRect.dropShadowBlurRadius).toBe(0);
    // expect(defaultRect.dropShadowColor).toBe('black');
    // expect(defaultRect.dropShadowColorRGB).toEqual({
    //   b: 0,
    //   g: 0,
    //   opacity: 1,
    //   r: 0,
    // });
    // expect(defaultRect.dropShadowOffsetX).toBe(0);
    // expect(defaultRect.dropShadowOffsetY).toBe(0);
  });

  it('should calculate geometry & render bounds correctly.', () => {
    const path = new Path({
      d: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
      fill: '#F67676',
    });
    let bounds = path.getGeometryBounds();
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(100);
    expect(bounds.maxY).toEqual(100);

    bounds = Path.getGeometryBounds({});
    expect(bounds.minX).toEqual(0);
    expect(bounds.minY).toEqual(0);
    expect(bounds.maxX).toEqual(0);
    expect(bounds.maxY).toEqual(0);

    bounds = path.getRenderBounds();
    expect(bounds.minX).toEqual(-0.5);
    expect(bounds.minY).toEqual(-0.5);
    expect(bounds.maxX).toEqual(100.5);
    expect(bounds.maxY).toEqual(100.5);
  });
});
