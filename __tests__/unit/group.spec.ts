import { Group } from '../../packages/core/src';

describe('Group', () => {
  it('should throw error since method not implemented.', () => {
    const group = new Group();
    expect(group.renderable).toBe(false);
    expect(group.visible).toBe(true);
    expect(() => group.containsPoint(0, 0)).toThrowError();
    expect(group.getGeometryBounds).toThrowError();
    expect(group.getRenderBounds).toThrowError();
    group.destroy();
  });
});
