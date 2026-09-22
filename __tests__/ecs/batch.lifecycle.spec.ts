import { BatchManager } from '../../packages/ecs/src/systems/BatchManager';
import { Circle, Renderable } from '../../packages/ecs/src/components';

let mockDrawcalls: any[] = [];
jest.mock('../../packages/ecs/src/drawcalls', () => {
  class Drawcall {
    shapes: any[] = [];
    destroyed = false;
    constructor() {
      mockDrawcalls.push(this);
    }
    add(shape: any) {
      if (!this.shapes.includes(shape)) this.shapes.push(shape);
    }
    remove(shape: any) {
      this.shapes = this.shapes.filter((s) => s !== shape);
    }
    validate() {
      return true;
    }
    destroy = jest.fn(() => {
      this.destroyed = true;
    });
  }
  return { Drawcall, SDF: Drawcall, SmoothPolyline: Drawcall };
});
jest.mock('../../packages/ecs/src/components', () => ({
  Circle: class {},
  Renderable: class {},
  UI: class {},
}));
jest.mock('../../packages/ecs/src/utils', () => ({}));
jest.mock('../../packages/ecs/src/systems/Sort', () => ({}));
jest.mock('../../packages/ecs/src/history', () => ({}));

describe('BatchManager resource ownership', () => {
  beforeEach(() => {
    mockDrawcalls = [];
  });
  function shape(batchable: boolean) {
    return {
      has: (type: any) => type === Circle,
      read: (type: any) => (type === Renderable ? { batchable } : {}),
    } as any;
  }
  function manager() {
    return new BatchManager(null, null, null, null, null);
  }

  it('releases cached non-batched drawcalls even after culling and clearing', () => {
    const batch = manager();
    const node = shape(false);
    batch.add(node);
    batch.remove(node, false);
    batch.clear();
    batch.destroy();
    batch.destroy();
    expect(mockDrawcalls).toHaveLength(2);
    mockDrawcalls.forEach((drawcall) =>
      expect(drawcall.destroy).toHaveBeenCalledTimes(1),
    );
  });

  it('releases shared batched drawcalls exactly once', () => {
    const batch = manager();
    batch.add(shape(true));
    batch.add(shape(true));
    batch.destroy();
    expect(mockDrawcalls).toHaveLength(2);
    mockDrawcalls.forEach((drawcall) =>
      expect(drawcall.destroy).toHaveBeenCalledTimes(1),
    );
  });

  it('releases unused replacement drawcalls and keeps the cached drawcalls alive', () => {
    const batch = manager();
    const node = shape(false);
    batch.add(node);
    batch.add(node);
    expect(mockDrawcalls).toHaveLength(4);
    expect(mockDrawcalls[0].destroy).not.toHaveBeenCalled();
    expect(mockDrawcalls[2].destroy).toHaveBeenCalledTimes(1);
    batch.destroy();
    mockDrawcalls.forEach((drawcall) =>
      expect(drawcall.destroy).toHaveBeenCalledTimes(1),
    );
  });
});
