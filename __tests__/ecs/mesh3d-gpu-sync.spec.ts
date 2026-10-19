import {
  Canvas,
  DefaultRenderer3DPlugin,
  GPUResource,
  Last,
  Mesh3D,
  Mesh3DNode,
  Material3D,
  MeshPipeline3D,
  Extrude3D,
  System,
  system,
  type API,
  type SerializedNode,
} from '../../packages/ecs/src';
import { getMeshPipeline3D } from '../../packages/ecs/src/systems/mesh3d-bridge';
import { createDocumentWorld } from '../helpers/ecs-document';
import { fakeMeshGPU } from './helpers/mesh-gpu';

jest.mock('../../packages/ecs/src/utils/load-image-bitmap', () => ({
  loadImageBitmapUniversal: jest.fn(async () => ({ width: 4, height: 2 })),
}));
jest.mock('../../packages/ecs/src/utils/environment-map', () => ({
  ...jest.requireActual('../../packages/ecs/src/utils/environment-map'),
  prefilterEnvironment: jest.fn(() => {
    const result = new Float32Array(36);
    result[0] = 0.7;
    return {
      pixels: new Uint8ClampedArray(128 * 124 * 4),
      irradiance: result,
    };
  }),
}));

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
let gpu: ReturnType<typeof fakeMeshGPU>;
class DrawMeshes extends System {
  canvases = this.query((q) => q.current.with(Canvas, GPUResource).read);
  access = this.query((q) => q.usingAll.read);
  execute() {
    for (const canvas of this.canvases.current)
      getMeshPipeline3D(canvas)?.drawMeshes(gpu.pass, canvas, 200, 200);
  }
}
beforeAll(async () => {
  gpu = fakeMeshGPU();
  world = await createDocumentWorld(1, false, [
    DefaultRenderer3DPlugin,
    () => {
      system(Last)(DrawMeshes);
      system((s) => s.inAnyOrderWith(s.allSystems).after(MeshPipeline3D))(
        DrawMeshes,
      );
    },
  ]);
  [api] = world.apis;
  await world.edit(
    api,
    () =>
      api.getCanvas().add(GPUResource, {
        device: gpu.device,
        renderCache: gpu.renderCache,
        scope: gpu.scope,
      }),
    'NEVER',
  );
});
afterAll(async () => {
  await world?.dispose();
  gpu?.scope.dispose();
});
beforeEach(async () => {
  await world.reset(api, []);
  await world.edit(
    api,
    (editor) => editor.gotoLandmark({ x: 0, y: 0, zoom: 1 }, { duration: 0 }),
    'NEVER',
  );
  await world.frame();
  await world.frame();
});
const companion = () => {
  const source = api.getEntity(api.getNodeById('model'));
  return source.has(Mesh3DNode)
    ? source.read(Mesh3DNode).meshEntity!
    : source.read(Extrude3D).meshEntity!;
};
for (const type of ['mesh3d', 'rect'] as const) {
  it(`keeps ${type} GPU geometry through idle, pose and material edits in the real schedule`, async () => {
    const node: SerializedNode =
      type === 'mesh3d'
        ? {
            id: 'model',
            type,
            zIndex: 0,
            x: 10,
            y: 20,
            width: 40,
            height: 40,
          }
        : {
            id: 'model',
            type,
            zIndex: 0,
            x: 10,
            y: 20,
            width: 40,
            height: 40,
            extrude3d: 20,
            fills: [{ type: 'solid', value: '#ff0000' }],
          };
    await world.reset(api, [node]);
    expect(gpu.draws.length).toBeGreaterThan(0);
    const count = gpu.buffers.length;
    const model = gpu.draws.at(-1)!.uniformBufferBindings[1].buffer;
    const uploads = model.setSubData.mock.calls.length;
    const scene = gpu.draws.at(-1)!.uniformBufferBindings[0].buffer;
    const sceneUploads = scene.setSubData.mock.calls.length;
    const bindings = gpu.bindings.length;
    for (let i = 0; i < 4; i++) await world.frame();
    expect(model.setSubData).toHaveBeenCalledTimes(uploads);
    expect(scene.setSubData).toHaveBeenCalledTimes(sceneUploads);
    expect(gpu.bindings).toHaveLength(bindings);
    await world.edit(
      api,
      (editor) => editor.gotoLandmark({ x: 5, y: 7, zoom: 2 }, { duration: 0 }),
      'NEVER',
    );
    expect(model.setSubData).toHaveBeenCalledTimes(uploads);
    await world.edit(api, (editor) =>
      editor.updateNode(editor.getNodeById('model'), { x: 50, y: 60 }),
    );
    const cameraUploads = scene.setSubData.mock.calls.length;
    expect(cameraUploads).toBeGreaterThan(sceneUploads);
    const expectedX = 70;
    expect(new Float32Array(model.bytes.buffer)[12]).toBe(expectedX);
    await world.edit(api, (editor) =>
      editor.updateNode(
        editor.getNodeById('model'),
        type === 'mesh3d'
          ? {
              material3d: { baseColor: '#00ff00' },
            }
          : { fills: [{ type: 'solid', value: '#00ff00' }] },
      ),
    );
    expect([...new Float32Array(model.bytes.buffer).slice(32, 36)]).toEqual([
      0, 1, 0, 1,
    ]);
    expect(model.setSubData).toHaveBeenCalledTimes(uploads + 2);
    expect(gpu.buffers).toHaveLength(count);
    expect(model.destroy).not.toHaveBeenCalled();
    expect(scene.setSubData).toHaveBeenCalledTimes(cameraUploads);
    expect(gpu.bindings).toHaveLength(bindings);
  });
}

it('uploads in-place Mesh3D edits in the same frame and only once', async () => {
  await world.reset(api, [
    {
      id: 'model',
      type: 'mesh3d',
      zIndex: 0,
      x: 0,
      y: 0,
      width: 40,
      height: 40,
    },
  ]);
  // Let the procedural companion establish its source geometry cache first.
  await world.frame();
  const count = gpu.buffers.length;
  await world.edit(
    api,
    () => {
      companion().write(Mesh3D).positions[0] = 77;
    },
    'NEVER',
  );
  const vertices = (gpu.pass.setVertexInput as jest.Mock).mock.calls.at(
    -1,
  )[1][0].buffer;
  expect(new Float32Array(vertices.bytes.buffer)[0]).toBe(77);
  expect(gpu.buffers).toHaveLength(count + 5);
  await world.frame();
  expect(gpu.buffers).toHaveLength(count + 5);
});

it('loads and clears an equirectangular material reflection without rebuilding geometry', async () => {
  await world.reset(api, [
    {
      id: 'model',
      type: 'mesh3d',
      zIndex: 0,
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      material3d: { environmentMap: '/studio.png', metallic: 1 },
    },
  ]);
  await world.frame();
  expect(companion().read(Material3D).environmentMap).toBe('/studio.png');
  const draw = gpu.draws.at(-1)!;
  const model = draw.uniformBufferBindings[1].buffer;
  expect(new Float32Array(model.bytes.buffer)[55]).toBe(1);
  expect(new Float32Array(model.bytes.buffer)[60]).toBeCloseTo(0.7);
  expect(draw.samplerBindings).toHaveLength(7);
  const geometryBuffers = gpu.buffers.length;

  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('model'), {
      material3d: { environmentMap: null, metallic: 1 },
    }),
  );
  expect(companion().read(Material3D).environmentMap).toBeNull();
  expect(new Float32Array(model.bytes.buffer)[55]).toBe(0);
  expect(new Float32Array(model.bytes.buffer)[60]).toBe(0);
  expect(gpu.buffers).toHaveLength(geometryBuffers);
});

it('updates procedural geometry immediately and releases a deleted mesh before another draw', async () => {
  await world.reset(api, [
    {
      id: 'model',
      type: 'mesh3d',
      zIndex: 0,
      x: 0,
      y: 0,
      width: 40,
      height: 40,
    },
  ]);
  const count = gpu.buffers.length;
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('model'), { geometry: 'sphere' }),
  );
  expect(gpu.buffers).toHaveLength(count + 5);
  const vertices = (gpu.pass.setVertexInput as jest.Mock).mock.calls.at(
    -1,
  )[1][0].buffer;
  expect([...new Float32Array(vertices.bytes.buffer)]).toEqual([
    ...companion().read(Mesh3D).positions,
  ]);
  const current = gpu.buffers.slice(count);
  await world.reset(api, []);
  const draws = gpu.draws.length;
  // Deleter releases document entities at the end of Last. The next cache
  // pass must reclaim their companions before another draw.
  await world.frame();
  expect(gpu.draws).toHaveLength(draws);
  for (const buffer of current) expect(buffer.destroy).toHaveBeenCalledTimes(1);
});

it('reads distinct live light components and refreshes light edits/deletion in the real schedule', async () => {
  await world.reset(api, [
    {
      id: 'model',
      type: 'mesh3d',
      zIndex: 0,
      x: 0,
      y: 0,
      width: 40,
      height: 40,
    },
    {
      id: 'ambient',
      type: 'light3d',
      lightType: 'ambient',
      zIndex: 1,
      x: 0,
      y: 0,
      color: '#ff0000',
      intensity: 0.25,
    },
    {
      id: 'directional',
      type: 'light3d',
      lightType: 'directional',
      zIndex: 2,
      x: 0,
      y: 0,
      color: '#00ff00',
      intensity: 0.5,
    },
  ]);
  const scene = gpu.draws.at(-1)!.uniformBufferBindings[0].buffer;
  const data = new Float32Array(scene.bytes.buffer);
  expect([...data.slice(52, 56)]).toEqual([0.25, 0, 0, 1]);
  expect(data[56]).toBe(1);
  expect([...data.slice(124, 128)]).toEqual([0, 1, 0, 0]);
  const bindings = gpu.bindings.length;
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('ambient'), { intensity: 0.5 }),
  );
  expect(data[52]).toBe(0.5);
  const uploads = scene.setSubData.mock.calls.length;
  await world.frame();
  expect(scene.setSubData).toHaveBeenCalledTimes(uploads);
  await world.edit(api, (editor) => editor.deleteNodesById(['directional']));
  await world.frame();
  expect(data[56]).toBe(0); // Explicit ambient-only lighting has no directional fill.
  expect([...data.slice(124, 128)]).toEqual([0, 0, 0, 0]);
  expect(gpu.bindings).toHaveLength(bindings);
});
