import { MeshPipeline } from '../../packages/ecs/src/systems/MeshPipeline';
import {
  Canvas,
  GPUResource,
  RasterScreenshotRequest,
} from '../../packages/ecs/src/components';
import { ResourceScope } from '../../packages/ecs/src/resources/ResourceScope';

const mockBatchManagers: any[] = [];

jest.mock('../../packages/ecs/node_modules/@lastolivegames/becsy', () => ({
  ...jest.requireActual(
    '../../packages/ecs/node_modules/@lastolivegames/becsy',
  ),
  System: class {
    query() {
      return {
        current: [],
        added: [],
        changed: [],
        removed: [],
        addedOrChanged: [],
        addedChangedOrRemoved: [],
      };
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
jest.mock('../../packages/ecs/src/history/ElementsChange', () => ({
  safeAddComponent: jest.fn(),
}));
jest.mock('../../packages/ecs/src/systems/Transform', () => ({}));
jest.mock('../../packages/ecs/src/systems/SetupDevice', () => ({
  SetupDevice: class {},
}));
jest.mock('../../packages/ecs/src/render-graph/GridRenderer', () => ({
  GridRenderer: class {
    destroy = jest.fn();
  },
}));
jest.mock('../../packages/ecs/src/systems/BatchManager', () => ({
  BatchManager: class {
    constructor() {
      mockBatchManagers.push(this);
    }
    destroy = jest.fn();
    showUIs = jest.fn();
    hideUIs = jest.fn();
    setPathInstancingEnabled = jest.fn();
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
  it('redraws an idle scene when asynchronous image decoding dirties its material', () => {
    const pipeline = new MeshPipeline();
    const camera = {};
    const canvas = { read: () => ({ cameras: [camera] }) };
    const render = jest
      .spyOn(pipeline as any, 'renderCamera')
      .mockImplementation(() => {});
    (pipeline as any).canvases.current = [canvas];

    // No camera, node, theme or fill edits: the scene is idle.
    pipeline.execute();
    expect(render).not.toHaveBeenCalled();
    // The image decode callback only adds MaterialDirty to its renderable.
    (pipeline as any).dirtyMaterials.added = [{}];
    pipeline.execute();
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(canvas, camera, true);
    (pipeline as any).dirtyMaterials.added = [];
    pipeline.execute();
    expect(render).toHaveBeenCalledTimes(1);
  });

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

  it.each(['error', 'empty'])(
    'releases isolated export resources and preserves the screen renderer (%s)',
    (outcome) => {
      const gpu = resource();
      const pipeline = new MeshPipeline();
      (pipeline as any).setupDevice = { getOffscreenGPUResource: () => gpu };
      if (outcome === 'empty')
        gpu.swapChain.getCanvas = () => ({ width: 0, height: 0 } as any);
      const camera = {};
      const screen = {
        batchManager: { showUIs: jest.fn(), destroy: jest.fn() },
      };
      pipeline.renderers.set(camera as any, screen as any);
      const create = jest.spyOn(pipeline as any, 'createRenderer');
      const values = new Map<any, any>([
        [
          Canvas,
          {
            api: {
              getAppState: () => ({ filter: '' }),
              getBounds: () => ({ minX: 0, minY: 0, maxX: 0, maxY: 0 }),
            },
          },
        ],
        [GPUResource, gpu],
        [RasterScreenshotRequest, { nodes: [{ id: '1' }] }],
      ]);
      const canvas = {
        has: (type: any) => values.has(type),
        read: (type: any) => values.get(type),
      };
      const render = () => (pipeline as any).renderCamera(canvas, camera);
      if (outcome === 'error') expect(render).toThrow('render failed');
      else expect(render).not.toThrow();
      const renderer = create.mock.results[0].value;
      // Export uses a disposable, isolated plan; restoring UI on the shared screen
      // manager would violate that isolation. Check ownership instead of that call.
      const exportBatch = mockBatchManagers[mockBatchManagers.length - 1];
      expect(exportBatch).not.toBe(renderer.batchManager);
      expect(exportBatch.hideUIs).toHaveBeenCalledTimes(1);
      expect(exportBatch.destroy).toHaveBeenCalledTimes(1);
      expect(pipeline.renderers.get(camera as any)).toBe(screen);
      expect(screen.batchManager.destroy).not.toHaveBeenCalled();
      expect(screen.batchManager.showUIs).not.toHaveBeenCalled();
      expect((pipeline as any).screenRedraw.has(camera)).toBe(true);
      expect((pipeline as any).partialRasterRenderers.size).toBe(0);
      expect(renderer.batchManager.destroy).toHaveBeenCalledTimes(1);
      expect(renderer.uniformBuffer.destroy).toHaveBeenCalledTimes(1);
      expect(pipeline.renderers.size).toBe(1);
      gpu.scope.dispose();
      expect(renderer.uniformBuffer.destroy).toHaveBeenCalledTimes(1);
    },
  );
});
