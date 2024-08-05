import { Group } from '../../packages/core/src';

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
});
