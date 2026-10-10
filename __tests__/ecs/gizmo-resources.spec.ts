import { BufferUsage } from '../../packages/device-api/src';
import { GizmoResources } from '../../packages/ecs/src/systems/gizmo3d/gizmo-resources';
import {
  getGizmoMeshParts,
  gizmoPartDrawLayer,
} from '../../packages/ecs/src/utils/gizmo-interaction';
import { fakeGizmoGPU, gizmoInstance } from './helpers/gizmo-gpu';

const parts = [...getGizmoMeshParts()].sort(
  (a, b) =>
    gizmoPartDrawLayer(a.kind, a.axis) - gizmoPartDrawLayer(b.kind, b.axis),
);
const floats = (buffer: { bytes: Uint8Array }) =>
  new Float32Array(buffer.bytes.buffer);

it('preserves every selected object and handle until deferred pass submission', () => {
  const gpu = fakeGizmoGPU();
  const resources = new GizmoResources(gpu.device, gpu.renderCache);
  const first = gizmoInstance(1, -50);
  first.frame.zBias = [0.12, 0.34];
  const second = gizmoInstance(2, 80);
  second.activeAxis = 'y';
  second.activePartKind = 'rotate';
  resources.draw(gpu.pass, [first, second], 800, 400);
  expect(gpu.draws).toHaveLength(parts.length * 2);
  expect(
    new Set(gpu.draws.map((draw) => draw.uniformBufferBindings[1].buffer)).size,
  ).toBe(parts.length * 2);
  gpu.draws.forEach((draw, i) => {
    const instance = i < parts.length ? first : second;
    const part = parts[i % parts.length];
    const scene = floats(draw.uniformBufferBindings[0].buffer);
    const model = floats(draw.uniformBufferBindings[1].buffer);
    expect([...model.slice(44, 48)]).toEqual([...instance.frame.anchor, 0]);
    expect(model[12]).toBe(instance.frame.anchor[0]);
    expect(scene[51]).toBe(
      part.axis === instance.activeAxis && part.kind === instance.activePartKind
        ? 1
        : 0,
    );
    expect([...model.slice(32, 36)]).toEqual(
      Array.from(new Float32Array(part.color)),
    );
    const legacy =
      gpu.mocks.createProgram.mock.results[0].value.setUniformsLegacy.mock
        .calls[i][0];
    expect([...scene.slice(48, 52)]).toEqual(
      Array.from(new Float32Array(legacy.u_SceneParams)),
    );
    expect([...model.slice(0, 16)]).toEqual(Array.from(legacy.u_ModelMatrix3D));
    expect([...model.slice(16, 32)]).toEqual(
      Array.from(legacy.u_NormalMatrix3D),
    );
    expect([...model.slice(36, 40)]).toEqual(legacy.u_LightParams);
    expect([...model.slice(40, 44)]).toEqual(
      Array.from(new Float32Array(legacy.u_LightDirection)),
    );
  });
  expect(gpu.pass.setViewport).toHaveBeenCalledWith(0, 0, 800, 400);
  resources.destroy();
  gpu.scope.dispose();
});

it('shares geometry, reuses unchanged allocations and releases only deselected objects', () => {
  const gpu = fakeGizmoGPU();
  const resources = new GizmoResources(gpu.device, gpu.renderCache);
  const geometry = [...gpu.buffers];
  resources.draw(gpu.pass, [gizmoInstance(1), gizmoInstance(2)], 400, 200);
  const allocations = gpu.buffers.length;
  const firstBindings = gpu.bindings.slice(0, parts.length);
  const secondBindings = gpu.bindings.slice(parts.length);
  resources.draw(
    gpu.pass,
    [gizmoInstance(1, 40), gizmoInstance(2, 90)],
    400,
    200,
  );
  expect(gpu.buffers).toHaveLength(allocations);
  expect(floats(firstBindings[0].uniformBufferBindings[1].buffer)[44]).toBe(40);
  resources.retainObjects(new Set([2]));
  for (const binding of firstBindings) {
    expect(binding.destroy).toHaveBeenCalledTimes(1);
    binding.uniformBufferBindings.forEach(({ buffer }) =>
      expect(buffer.destroy).toHaveBeenCalledTimes(1),
    );
  }
  for (const resource of [...geometry, ...secondBindings])
    expect(resource.destroy).not.toHaveBeenCalled();
  resources.draw(gpu.pass, [gizmoInstance(2), gizmoInstance(1)], 400, 200);
  expect(
    gpu.buffers.filter((buffer) => buffer.usage !== BufferUsage.UNIFORM),
  ).toEqual(geometry);
  expect(gpu.buffers.length).toBe(allocations + parts.length * 2);
  resources.destroy();
  for (const resource of [...gpu.buffers, ...gpu.bindings])
    expect(resource.destroy).toHaveBeenCalledTimes(1);
  gpu.scope.dispose();
});

it('leaves borrowed pipeline resources to RenderCache and releases before its owner', () => {
  const gpu = fakeGizmoGPU();
  const resources = new GizmoResources(gpu.device, gpu.renderCache);
  resources.draw(gpu.pass, [gizmoInstance(1)], 400, 200);
  gpu.scope.add(() => resources.destroy());
  resources.destroy();
  for (const resource of gpu.borrowed)
    expect(resource.destroy).not.toHaveBeenCalled();
  gpu.scope.dispose();
  resources.destroy();
  for (const resource of [...gpu.buffers, ...gpu.bindings, ...gpu.borrowed])
    expect(resource.destroy).toHaveBeenCalledTimes(1);
  const firstCacheRelease = gpu.releases.findIndex((label) =>
    label.startsWith('cached'),
  );
  expect(gpu.releases.slice(0, firstCacheRelease)).toHaveLength(
    gpu.buffers.length + gpu.bindings.length,
  );
  expect(gpu.releases.at(-1)).toBe('device');
  expect(() => resources.draw(gpu.pass, [], 1, 1)).toThrow('disposed');
});

it('rolls back partial geometry allocations and allows retry with the same cache', () => {
  const gpu = fakeGizmoGPU();
  const allocate = gpu.mocks.createBuffer.getMockImplementation()!;
  gpu.mocks.createBuffer
    .mockImplementationOnce(allocate)
    .mockImplementationOnce(() => {
      throw new Error('out of memory');
    });
  expect(() => new GizmoResources(gpu.device, gpu.renderCache)).toThrow(
    'out of memory',
  );
  expect(gpu.buffers[0].destroy).toHaveBeenCalledTimes(1);
  for (const resource of gpu.borrowed)
    expect(resource.destroy).not.toHaveBeenCalled();
  const resources = new GizmoResources(gpu.device, gpu.renderCache);
  resources.destroy();
  gpu.scope.dispose();
});

it('rolls back a failed object allocation without corrupting other selected objects', () => {
  const gpu = fakeGizmoGPU();
  const resources = new GizmoResources(gpu.device, gpu.renderCache);
  resources.draw(gpu.pass, [gizmoInstance(1)], 400, 200);
  const prior = [...gpu.buffers, ...gpu.bindings];
  const count = gpu.buffers.length;
  const allocate = gpu.mocks.createBindings.getMockImplementation()!;
  gpu.mocks.createBindings
    .mockImplementationOnce(allocate)
    .mockImplementationOnce(() => {
      throw new Error('binding failed');
    });
  expect(() =>
    resources.draw(gpu.pass, [gizmoInstance(1), gizmoInstance(2)], 400, 200),
  ).toThrow('binding failed');
  for (const buffer of gpu.buffers.slice(count))
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  for (const resource of prior) expect(resource.destroy).not.toHaveBeenCalled();
  resources.draw(gpu.pass, [gizmoInstance(1), gizmoInstance(2)], 400, 200);
  resources.destroy();
  gpu.scope.dispose();
});

it('attempts every release after a destroy failure and remains idempotent', () => {
  const gpu = fakeGizmoGPU();
  const resources = new GizmoResources(gpu.device, gpu.renderCache);
  resources.draw(gpu.pass, [gizmoInstance(1), gizmoInstance(2)], 400, 200);
  gpu.buffers.at(-1)!.destroy.mockImplementation(() => {
    throw new Error('destroy failed');
  });
  expect(() => resources.destroy()).toThrow('Resource cleanup failed');
  expect(() => resources.destroy()).not.toThrow();
  for (const resource of [...gpu.buffers, ...gpu.bindings])
    expect(resource.destroy).toHaveBeenCalledTimes(1);
  gpu.scope.dispose();
});

it('preserves the allocation error when partial cleanup also fails', () => {
  const gpu = fakeGizmoGPU();
  const allocate = gpu.mocks.createBuffer.getMockImplementation()!;
  gpu.mocks.createBuffer
    .mockImplementationOnce((descriptor) => {
      const buffer = allocate(descriptor);
      buffer.destroy.mockImplementation(() => {
        throw new Error('cleanup failed');
      });
      return buffer;
    })
    .mockImplementationOnce(() => {
      throw new Error('allocation failed');
    });
  expect(() => new GizmoResources(gpu.device, gpu.renderCache)).toThrow(
    'allocation failed',
  );
  expect(gpu.buffers[0].destroy).toHaveBeenCalledTimes(1);
  gpu.scope.dispose();
});
