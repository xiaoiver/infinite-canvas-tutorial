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
    needsNodeLayerBlend() {
      return this.shapes[0]?.blendMode != null;
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
    return new BatchManager(null, null, null, null, {
      getNodeByEntity: (node: any) => node,
    } as any);
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

  it('reuses cached drawcalls without allocating replacements', () => {
    const batch = manager();
    const node = shape(false);
    batch.add(node);
    batch.add(node);
    expect(mockDrawcalls).toHaveLength(2);
    expect(mockDrawcalls[0].destroy).not.toHaveBeenCalled();
    batch.destroy();
    mockDrawcalls.forEach((drawcall) =>
      expect(drawcall.destroy).toHaveBeenCalledTimes(1),
    );
  });
  it('composites all drawcalls of one blended node together', () => {
    const batch = manager();
    const node = shape(false);
    node.blendMode = 'multiply';
    batch.add(node);
    const segments = batch.buildFlushSegments();
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      type: 'layerBlend',
      drawcalls: mockDrawcalls,
    });
    batch.destroy();
  });

  it('moves nodes out of instancing when blend mode changes and releases both caches', () => {
    const batch = manager();
    const node = shape(true);
    batch.add(node);
    const shared = [...mockDrawcalls];
    node.blendMode = 'multiply';
    batch.add(node);
    shared.forEach((d) => expect(d.shapes).not.toContain(node));
    expect(mockDrawcalls).toHaveLength(4);
    expect(batch.buildFlushSegments()).toHaveLength(1);
    batch.remove(node);
    mockDrawcalls
      .slice(2)
      .forEach((d) => expect(d.destroy).toHaveBeenCalledTimes(1));
    batch.destroy();
    shared.forEach((d) => expect(d.destroy).toHaveBeenCalledTimes(1));
  });
});
