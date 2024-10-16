import { Group, Rect } from '../../packages/core/src';

describe('Transformable mixin', () => {
  it('should transform correctly.', () => {
    const group = new Group();
    expect(group.position.x).toEqual(0);
    expect(group.scale.x).toEqual(1);
    expect(group.pivot.x).toEqual(0);
    expect(group.skew.x).toEqual(0);
    expect(group.rotation).toEqual(0);
    expect(group.angle).toEqual(0);
    expect(group.localTransform).toEqual({
      a: 1,
      array: null,
      b: 0,
      c: 0,
      d: 1,
      tx: 0,
      ty: 0,
    });
    expect(group.worldTransform).toEqual({
      a: 1,
      array: null,
      b: 0,
      c: 0,
      d: 1,
      tx: 0,
      ty: 0,
    });

    // Won't recalculate transform immediately.
    group.position = { x: 100, y: 100 };
    group.scale = { x: 2, y: 2 };
    group.pivot = { x: 50, y: 50 };
    group.skew = { x: 10, y: 10 };
    group.angle = 10;
    group.rotation = 10;
    expect(group.worldTransform).toEqual({
      a: 1,
      array: null,
      b: 0,
      c: 0,
      d: 1,
      tx: 0,
      ty: 0,
    });
  });

  it('should calculate bounds with transform correctly.', () => {
    const rect = new Rect({
      x: 100,
      y: 100,
      width: 100,
      height: 100,
    });
    let bounds = rect.getBounds();
    expect(bounds.minX).toEqual(99.5);
    expect(bounds.minY).toEqual(99.5);
    expect(bounds.maxX).toEqual(200.5);
    expect(bounds.maxY).toEqual(200.5);

    rect.position.x = 100;
    bounds = rect.getBounds();
    expect(bounds.minX).toEqual(199.5);
    expect(bounds.minY).toEqual(99.5);
    expect(bounds.maxX).toEqual(300.5);
    expect(bounds.maxY).toEqual(200.5);

    rect.position.x = 0;
    bounds = rect.getBounds();
    expect(bounds.minX).toEqual(99.5);
    expect(bounds.minY).toEqual(99.5);
    expect(bounds.maxX).toEqual(200.5);
    expect(bounds.maxY).toEqual(200.5);

    rect.scale.x = 2;
    bounds = rect.getBounds();
    expect(bounds.minX).toEqual(199);
    expect(bounds.minY).toEqual(99.5);
    expect(bounds.maxX).toEqual(401);
    expect(bounds.maxY).toEqual(200.5);
  });
});
