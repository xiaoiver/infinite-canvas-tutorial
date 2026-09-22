import { MeshPipeline } from '../../packages/ecs/src/systems/MeshPipeline';
import {
  Canvas,
  GPUResource,
  RasterScreenshotRequest,
} from '../../packages/ecs/src/components';
import { ResourceScope } from '../../packages/ecs/src/resources/ResourceScope';

jest.mock('../../packages/ecs/node_modules/@lastolivegames/becsy', () => ({
  System: class {
    query() {
      return {};
    }
    attach() {
      return {};
    }
  },
  co: (_target: any, _key: string, descriptor: any) => descriptor,
}));
jest.mock('../../packages/ecs/src/components', () => ({
  Canvas: class {},
  GPUResource: class {},
  RasterScreenshotRequest: class {},
}));
jest.mock('../../packages/ecs/src/utils', () => ({}));
jest.mock('../../packages/ecs/src/history', () => ({}));
jest.mock('../../packages/ecs/src/systems/Transform', () => ({}));
jest.mock('../../packages/ecs/src/systems/SetupDevice', () => ({
  SetupDevice: class {},
}));
jest.mock('../../packages/ecs/src/render-graph/GridRenderer', () => ({
  GridRenderer: class {
    destroy = jest.fn();
  },
}));
jest.mock(
  '../../packages/ecs/src/render-graph/PostProcessingRenderer',
  () => ({}),
);
jest.mock('../../packages/ecs/src/systems/BatchManager', () => ({
  BatchManager: class {
    destroy = jest.fn();
    showUIs = jest.fn();
  },
}));

function resource() {
  return {
    scope: new ResourceScope(),
    device: { createBuffer: () => ({ destroy: jest.fn() }) },
    renderGraph: { destroy: jest.fn() },
    swapChain: {
      getCanvas: () => {
        throw new Error('render failed');
      },
    },
  };
}

describe('renderer lifecycle', () => {
  it('releases renderer resources exactly once, before the shared device', () => {
    const gpu = resource();
    const pipeline = new MeshPipeline();
    const deviceCleanup = jest.fn();
    gpu.scope.add(deviceCleanup);
    const renderer = (pipeline as any).createRenderer(gpu, {});
    const filter = { destroy: jest.fn() };
    renderer.filters.blur = filter;
    pipeline.renderers.set({} as any, renderer);
    gpu.scope.dispose();
    pipeline.finalize();
    expect(renderer.uniformBuffer.destroy).toHaveBeenCalledTimes(1);
    expect(renderer.gridRenderer.destroy).toHaveBeenCalledTimes(1);
    expect(renderer.batchManager.destroy).toHaveBeenCalledTimes(1);
    expect(filter.destroy).toHaveBeenCalledTimes(1);
    expect(
      renderer.uniformBuffer.destroy.mock.invocationCallOrder[0],
    ).toBeLessThan(deviceCleanup.mock.invocationCallOrder[0]);
    expect(gpu.renderGraph.destroy).not.toHaveBeenCalled();
  });

  it('releases temporary export resources even when rendering throws', () => {
    const gpu = resource();
    const pipeline = new MeshPipeline();
    (pipeline as any).setupDevice = { getOffscreenGPUResource: () => gpu };
    const create = jest.spyOn(pipeline as any, 'createRenderer');
    const values = new Map<any, any>([
      [Canvas, { api: { getAppState: () => ({ filter: '' }) } }],
      [GPUResource, gpu],
      [RasterScreenshotRequest, { nodes: [{ id: '1' }] }],
    ]);
    const canvas = {
      has: (type: any) => values.has(type),
      read: (type: any) => values.get(type),
    };
    expect(() => (pipeline as any).renderCamera(canvas, {})).toThrow(
      'render failed',
    );
    const renderer = create.mock.results[0].value;
    expect(renderer.batchManager.showUIs).toHaveBeenCalledTimes(1);
    expect(renderer.batchManager.destroy).toHaveBeenCalledTimes(1);
    expect(renderer.uniformBuffer.destroy).toHaveBeenCalledTimes(1);
    expect(pipeline.renderers.size).toBe(0);
    gpu.scope.dispose();
    expect(renderer.uniformBuffer.destroy).toHaveBeenCalledTimes(1);
  });
});
