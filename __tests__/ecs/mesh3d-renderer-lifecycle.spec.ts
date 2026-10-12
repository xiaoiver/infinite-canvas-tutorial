import type { Entity } from '../../packages/ecs/src';
import {
  Camera3D,
  Canvas,
  Canvas3DScope,
  Extrude3D,
  GPUResource,
  Material3D,
  Light3D,
  Mesh3D,
  Transform3D,
  ToBeDeleted,
} from '../../packages/ecs/src/components';
import { MeshPipeline3D } from '../../packages/ecs/src/systems/MeshPipeline3D';
import { createGeometry } from '../../packages/ecs/src/utils/geometry3d';
import { loadImageBitmapUniversal } from '../../packages/ecs/src/utils/load-image-bitmap';
import { fakeMeshGPU } from './helpers/mesh-gpu';

// Controlled query snapshots exercise resource ownership; browser tests exercise
// the real ECS schedule and geometry write tracking with actual WebGL buffers.
jest.mock('../../packages/ecs/node_modules/@lastolivegames/becsy', () => ({
  ...jest.requireActual<any>(
    '../../packages/ecs/node_modules/@lastolivegames/becsy',
  ),
  System: class {
    static group = jest.requireActual<any>(
      '../../packages/ecs/node_modules/@lastolivegames/becsy',
    ).System.group;
    query() {
      return { current: [], removed: [], addedOrChanged: [] };
    }
    attach() {
      return { hasGizmoContent: () => false };
    }
  },
  co: (_target: any, _key: string, descriptor: any) => descriptor,
}));
jest.mock('../../packages/ecs/src/utils/load-image-bitmap');
const load = loadImageBitmapUniversal as jest.MockedFunction<
  typeof loadImageBitmapUniversal
>;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  jest.clearAllMocks();
});
function fixture(count = 1) {
  const renderer = new MeshPipeline3D();
  const entity = (values: Map<any, any>, id: number): Entity =>
    ({
      __id: id,
      has: (type: any) => values.has(type),
      read: (type: any) => values.get(type),
      isSame(other: Entity) {
        return other.__id === id;
      },
    } as unknown as Entity);
  const slots = Array.from({ length: count }, (_, i) => {
    const gpu = fakeMeshGPU();
    cleanups.push(() => gpu.scope.dispose());
    const values = new Map<any, any>([
      [Canvas, { api: {}, width: 200, height: 200 }],
      [GPUResource, gpu],
    ]);
    const canvas = entity(values, i * 3);
    const mesh = new Mesh3D(createGeometry({ type: 'cube' }));
    const material = new Material3D();
    const transform = new Transform3D({ translation: [i * 20, 0, 0] });
    const meshValues = new Map<any, any>([
      [Canvas3DScope, { canvas }],
      [Mesh3D, mesh],
      [Material3D, material],
      [Transform3D, transform],
    ]);
    const target = entity(meshValues, i * 3 + 1);
    const camera = entity(
      new Map<any, any>([
        [Canvas3DScope, { canvas }],
        [Camera3D, new Camera3D()],
      ]),
      i * 3 + 2,
    );
    return {
      gpu,
      values,
      canvas,
      mesh,
      material,
      transform,
      target,
      camera,
      meshValues,
    };
  });
  const queries = renderer as any;
  queries.canvases.current = slots.map((s) => s.canvas);
  queries.cameras3D.current = slots.map((s) => s.camera);
  queries.meshes3D.current = slots.map((s) => s.target);
  cleanups.push(() => renderer.finalize());
  const draw = (i = 0) =>
    renderer.drawMeshes(slots[i].gpu.pass, slots[i].canvas, 400, 400);
  return { renderer, queries, slots, draw, entity };
}

it('reuses geometry while updating pose/material uniforms and avoids duplicate held companions', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    draw,
    entity,
  } = fixture();
  queries.extrudeSources.current = [
    entity(
      new Map([
        [
          Extrude3D,
          {
            meshEntity: entity(slot.meshValues, slot.target.__id),
          },
        ],
      ]),
      99,
    ),
  ];
  draw();
  expect(slot.gpu.draws).toHaveLength(1);
  const buffers = [...slot.gpu.buffers];
  const model = slot.gpu.draws[0].uniformBufferBindings[1].buffer;
  slot.transform.translation = [30, 40, 50];
  slot.material.baseColor = [0, 1, 0, 1];
  renderer.execute();
  draw();
  expect(slot.gpu.buffers).toEqual(buffers);
  const floats = new Float32Array(model.bytes.buffer);
  expect([...floats.slice(12, 15)]).toEqual([30, 40, 50]);
  expect([...floats.slice(32, 36)]).toEqual([0, 1, 0, 1]);
  for (const buffer of buffers) expect(buffer.destroy).not.toHaveBeenCalled();
  draw();
  expect(slot.gpu.bindings).toHaveLength(1);
  expect(slot.gpu.bindings[0].destroy).not.toHaveBeenCalled();
  expect(buffers[0].setSubData).toHaveBeenCalledTimes(1);
});

it('remembers geometry changes across skipped frames and uploads once on the next draw', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    draw,
  } = fixture();
  draw();
  slot.mesh.positions[0] = 12;
  queries.geometryDirty.addedOrChanged = [slot.target];
  renderer.execute();
  queries.geometryDirty.addedOrChanged = [];
  renderer.execute();
  draw();
  draw();
  expect(slot.gpu.buffers).toHaveLength(11); // scene + two complete mesh allocations
  const vertices = (slot.gpu.pass.setVertexInput as jest.Mock).mock.calls.at(
    -1,
  )[1][0].buffer;
  expect(new Float32Array(vertices.bytes.buffer)[0]).toBe(12);
  for (const buffer of slot.gpu.buffers.slice(1, 6))
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
});

it.each([
  'empty',
  'deleted',
  'pending deletion',
  'material removed',
  'scope moved',
])('reclaims %s mesh resources without another draw', (reason) => {
  const {
    renderer,
    queries,
    slots: [slot, other],
    draw,
  } = fixture(2);
  draw();
  draw(1);
  if (reason === 'pending deletion') slot.meshValues.set(ToBeDeleted, {});
  if (reason === 'empty') slot.mesh.positions = new Float32Array();
  if (reason === 'deleted') {
    queries.meshes3D.current = [other.target];
    queries.meshes3D.removed = [slot.target];
  }
  if (reason === 'material removed') slot.meshValues.delete(Material3D);
  if (reason === 'scope moved')
    slot.meshValues.set(Canvas3DScope, { canvas: other.canvas });
  renderer.execute();
  for (const buffer of slot.gpu.buffers.slice(1))
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  for (const buffer of other.gpu.buffers)
    expect(buffer.destroy).not.toHaveBeenCalled();
  if (reason === 'scope moved') {
    draw(1);
    expect(other.gpu.buffers).toHaveLength(11);
  }
});

it.each(['device', 'renderCache', 'scope'] as const)(
  'replaces resources when the canvas %s changes',
  (key) => {
    const {
      renderer,
      slots: [slot],
      draw,
    } = fixture();
    draw();
    const old = [...slot.gpu.buffers];
    const replacement = fakeMeshGPU();
    cleanups.push(() => replacement.scope.dispose());
    slot.values.set(GPUResource, { ...slot.gpu, [key]: replacement[key] });
    draw(); // replacement can precede execute
    for (const buffer of old) expect(buffer.destroy).toHaveBeenCalledTimes(1);
    const current = [...slot.gpu.buffers, ...replacement.buffers].filter(
      (b) => !old.includes(b),
    );
    expect(current.length).toBeGreaterThan(0);
    if (key === 'scope') {
      slot.gpu.scope.dispose();
      for (const buffer of current)
        expect(buffer.destroy).not.toHaveBeenCalled();
    }
    renderer.finalize();
    for (const buffer of current)
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
  },
);

it.each(['canvas removed', 'GPU removed', 'GPU replaced'])(
  'execute releases an invalid owner: %s',
  (reason) => {
    const {
      renderer,
      queries,
      slots: [slot],
      draw,
    } = fixture();
    draw();
    if (reason === 'canvas removed') queries.canvases.current = [];
    if (reason === 'GPU removed') slot.values.delete(GPUResource);
    if (reason === 'GPU replaced') {
      const replacement = fakeMeshGPU();
      cleanups.push(() => replacement.scope.dispose());
      slot.values.set(GPUResource, replacement);
    }
    renderer.execute();
    for (const resource of [...slot.gpu.buffers, ...slot.gpu.textures])
      expect(resource.destroy).toHaveBeenCalledTimes(1);
  },
);

it('releases owned buffers before the canvas device and leaves the other canvas alive', () => {
  const { renderer, slots, draw } = fixture(2);
  draw();
  draw(1);
  slots[0].gpu.scope.dispose();
  for (const resource of [
    ...slots[0].gpu.buffers,
    ...slots[0].gpu.textures,
    ...slots[0].gpu.borrowed,
  ])
    expect(resource.destroy).toHaveBeenCalledTimes(1);
  expect(slots[0].gpu.releases.at(-1)).toBe('device');
  for (const resource of [...slots[1].gpu.buffers, ...slots[1].gpu.borrowed])
    expect(resource.destroy).not.toHaveBeenCalled();
  draw(1);
  renderer.finalize();
  for (const resource of slots[1].gpu.borrowed)
    expect(resource.destroy).not.toHaveBeenCalled();
});

it('keeps scene and model uniforms independent even when canvases share a device', () => {
  const {
    slots: [first, second],
    draw,
  } = fixture(2);
  second.values.set(GPUResource, first.gpu);
  draw();
  draw(1);
  expect(first.gpu.buffers).toHaveLength(12);
  const a = first.gpu.draws[0].uniformBufferBindings;
  const b = second.gpu.draws[0].uniformBufferBindings;
  expect(a[0].buffer).not.toBe(b[0].buffer);
  expect(a[1].buffer).not.toBe(b[1].buffer);
  expect(new Float32Array(a[1].buffer.bytes.buffer)[12]).toBe(0);
  expect(new Float32Array(b[1].buffer.bytes.buffer)[12]).toBe(20);
});

it.each(['texture allocation', 'texture upload', 'sampler allocation'])(
  'rolls back failed pipeline setup: %s',
  (reason) => {
    const {
      slots: [slot],
      draw,
    } = fixture();
    if (reason === 'texture allocation')
      slot.gpu.createTexture.mockImplementationOnce(() => {
        throw new Error('setup failed');
      });
    if (reason === 'texture upload') {
      const allocate = slot.gpu.createTexture.getMockImplementation()!;
      slot.gpu.createTexture.mockImplementationOnce(() => {
        const texture = allocate();
        texture.setImageData.mockImplementationOnce(() => {
          throw new Error('setup failed');
        });
        return texture;
      });
    }
    if (reason === 'sampler allocation')
      slot.gpu.createSampler.mockImplementationOnce(() => {
        throw new Error('setup failed');
      });
    expect(draw).toThrow('setup failed');
    for (const resource of [...slot.gpu.buffers, ...slot.gpu.textures])
      expect(resource.destroy).toHaveBeenCalledTimes(1);
    for (const resource of slot.gpu.borrowed)
      expect(resource.destroy).not.toHaveBeenCalled();
    draw();
    expect(slot.gpu.draws).toHaveLength(1);
  },
);

it('attempts all releases after a destroy failure, including the other canvas', () => {
  const { renderer, slots, draw } = fixture(2);
  draw();
  draw(1);
  slots[0].gpu.buffers[1].destroy.mockImplementation(() => {
    throw new Error('destroy failed');
  });
  expect(() => renderer.finalize()).toThrow('Resource cleanup failed');
  expect(() => renderer.finalize()).not.toThrow();
  for (const slot of slots)
    for (const resource of [...slot.gpu.buffers, ...slot.gpu.textures])
      expect(resource.destroy).toHaveBeenCalledTimes(1);
});

it('discards a late image completion after its canvas is disposed', async () => {
  const {
    slots: [slot],
    draw,
  } = fixture();
  let resolve!: (image: ImageBitmap) => void;
  load.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  slot.material.map = 'https://example.test/image.png';
  draw();
  expect(load).toHaveBeenCalledTimes(1);
  draw();
  expect(load).toHaveBeenCalledTimes(1);
  slot.gpu.scope.dispose();
  const allocations = slot.gpu.textures.length;
  resolve({ width: 10, height: 10 } as ImageBitmap);
  await Promise.resolve();
  expect(slot.gpu.textures).toHaveLength(allocations);
  for (const texture of slot.gpu.textures)
    expect(texture.destroy).toHaveBeenCalledTimes(1);
});

it('refreshes scoped lights and camera viewport without reallocating bindings or model data', () => {
  const { renderer, queries, slots, draw, entity } = fixture(2);
  const light = new Light3D({ type: 'ambient', color: [1, 0, 0] });
  const scope = { canvas: slots[0].canvas };
  queries.lights3D.current = [
    entity(
      new Map<any, any>([
        [Light3D, light],
        [Canvas3DScope, scope],
      ]),
      99,
    ),
  ];
  draw(0);
  draw(1);
  const scenes = slots.map((slot) => slot.gpu.buffers[0]);
  const models = slots.map(
    (slot) => slot.gpu.draws[0].uniformBufferBindings[1].buffer,
  );
  const data = scenes.map((buffer) => new Float32Array(buffer.bytes.buffer));
  expect([...data[0].slice(52, 55)]).toEqual([1, 0, 0]);
  expect([...data[1].slice(52, 55)]).toEqual([1, 1, 1]);
  light.color[1] = 0.5;
  draw(0);
  draw(1);
  expect(data[0][53]).toBe(0.5);
  expect(scenes[0].setSubData).toHaveBeenCalledTimes(2);
  expect(scenes[1].setSubData).toHaveBeenCalledTimes(1);
  scope.canvas = slots[1].canvas;
  draw(0);
  draw(1);
  expect([...data[0].slice(52, 55)]).toEqual([1, 1, 1]);
  expect([...data[1].slice(52, 55)]).toEqual([1, 0.5, 0]);
  const oldProjection = data[0][0];
  renderer.drawMeshes(slots[0].gpu.pass, slots[0].canvas, 800, 400);
  expect(data[0][0]).toBeCloseTo(oldProjection / 2);
  for (const [i, slot] of slots.entries()) {
    expect(slot.gpu.bindings).toHaveLength(1);
    expect(models[i].setSubData).toHaveBeenCalledTimes(1);
  }
});

it.each(['map', 'specularMap', 'bumpMap'] as const)(
  'rebinds a completed %s and releases bindings before their dependencies',
  async (field) => {
    const {
      renderer,
      queries,
      slots: [slot],
      draw,
    } = fixture();
    let complete!: (image: ImageBitmap) => void;
    load.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    slot.material[field] = 'texture.png';
    draw();
    draw();
    const first = slot.gpu.bindings[0];
    expect(slot.gpu.bindings).toHaveLength(1);
    expect(
      first.samplerBindings.every(
        (binding) => binding.texture === (slot.gpu.textures[0] as unknown),
      ),
    ).toBe(true);
    complete({ width: 4, height: 4 } as ImageBitmap);
    await Promise.resolve();
    draw();
    const loaded = slot.gpu.textures[2];
    const index = ['map', 'specularMap', 'bumpMap'].indexOf(field);
    const second = slot.gpu.bindings[1];
    expect(second.samplerBindings[index].texture).toBe(loaded);
    expect(first.destroy).toHaveBeenCalledTimes(1);
    const model = second.uniformBufferBindings[1].buffer;
    expect(new Float32Array(model.bytes.buffer)[48 + index]).toBe(1);
    draw();
    expect(slot.gpu.bindings).toHaveLength(2);
    // Replacing the geometry must release the bindings that reference its UBO.
    queries.geometryDirty.addedOrChanged = [slot.target];
    renderer.execute();
    draw();
    const third = slot.gpu.bindings[2];
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(slot.gpu.releases.indexOf(`bindings:${second.id}`)).toBeLessThan(
      slot.gpu.releases.indexOf(`buffer:${model.id}`),
    );
    slot.gpu.scope.dispose();
    expect(third.destroy).toHaveBeenCalledTimes(1);
    expect(third.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      loaded.destroy.mock.invocationCallOrder[0],
    );
    expect(third.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      slot.gpu.buffers[0].destroy.mock.invocationCallOrder[0],
    );
  },
);

it('reuses the white binding through a failed load and replaces it when a texture is removed', async () => {
  const {
    slots: [slot],
    draw,
  } = fixture();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  load.mockRejectedValueOnce(new Error('image failed'));
  slot.material.map = 'failed.png';
  draw();
  await Promise.resolve();
  await Promise.resolve();
  draw();
  expect(slot.gpu.bindings).toHaveLength(1);
  load.mockResolvedValueOnce({ width: 2, height: 2 } as ImageBitmap);
  slot.material.map = 'ready.png';
  draw();
  await Promise.resolve();
  draw();
  expect(slot.gpu.bindings).toHaveLength(2);
  slot.material.map = null;
  draw();
  expect(slot.gpu.bindings).toHaveLength(3);
  expect(slot.gpu.bindings[2].samplerBindings[0].texture).toBe(
    slot.gpu.textures[0],
  );
  expect(new Float32Array(slot.gpu.buffers[5].bytes.buffer)[48]).toBe(0);
  warn.mockRestore();
});
