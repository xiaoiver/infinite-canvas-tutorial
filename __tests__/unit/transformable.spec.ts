import { Group } from '../../packages/core/src';

describe('Transformable mixin', () => {
  it('should throw error since method not implemented.', () => {
    const group = new Group();
    expect(() => group.containsPoint(0, 0)).toThrowError();
    expect(() => group.getGeometryBounds()).toThrowError();
    expect(() => group.getRenderBounds()).toThrowError();
    expect(() => group.destroy()).not.toThrowError();
  });
});
