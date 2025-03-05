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

    path.strokeLinecap = 'square';
    bounds = path.getRenderBounds();
    expect(bounds.minX).toBeCloseTo(-0.7071067811865476);
    expect(bounds.minY).toBeCloseTo(-0.7071067811865476);
    expect(bounds.maxX).toBeCloseTo(100.7071067811865476);
    expect(bounds.maxY).toBeCloseTo(100.7071067811865476);

    path.strokeLinejoin = 'miter';
    path.strokeMiterlimit = 4;
    bounds = path.getRenderBounds();
    expect(bounds.minX).toBeCloseTo(-0.7071067811865476);
    expect(bounds.minY).toBeCloseTo(-0.7071067811865476);
    expect(bounds.maxX).toBeCloseTo(100.7071067811865476);
    expect(bounds.maxY).toBeCloseTo(100.7071067811865476);
  });
});
