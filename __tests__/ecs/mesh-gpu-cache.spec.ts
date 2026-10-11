import { BufferUsage } from '../../packages/device-api/src';
import { Mesh3D } from '../../packages/ecs/src/components/geometry3d/Mesh3D';
import { MeshGPUCache } from '../../packages/ecs/src/systems/mesh3d/mesh-gpu-cache';
import { createGeometry } from '../../packages/ecs/src/utils/geometry3d';
import { fakeMeshGPU } from './helpers/mesh-gpu';

const cube = () => new Mesh3D(createGeometry({ type: 'cube' }));
const floats = (buffer: unknown) =>
  new Float32Array((buffer as { bytes: Uint8Array }).bytes.buffer);

it('reuses buffers across draws, keeps separate model uniforms, and coalesces geometry writes', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  const mesh = cube();
  const first = cache.get(1, mesh)!;
  const second = cache.get(2, mesh)!;
  expect(first.modelUniformBuffer).not.toBe(second.modelUniformBuffer);
  for (let i = 0; i < 5; i++) expect(cache.get(1, mesh)).toBe(first);
  expect(gpu.buffers).toHaveLength(10);
  mesh.positions[0] = 123;
  cache.invalidate([1, 100]);
  cache.invalidate([1]);
  const changed = cache.get(1, mesh)!;
  expect(floats(changed.vertexBuffer)[0]).toBe(123);
  expect(cache.get(1, mesh)).toBe(changed);
  expect(cache.get(2, mesh)).toBe(second);
  expect(gpu.buffers).toHaveLength(15);
  for (const buffer of gpu.buffers.slice(0, 5))
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  for (const buffer of gpu.buffers.slice(5))
    expect(buffer.destroy).not.toHaveBeenCalled();
  cache.destroy();
  cache.destroy();
  for (const buffer of gpu.buffers)
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  expect(() => cache.get(1, mesh)).toThrow('disposed');
  gpu.scope.dispose();
});

it.each(['valid', 'missing', 'invalid'] as const)(
  'uploads %s UVs with or without indices',
  (kind) => {
    const gpu = fakeMeshGPU();
    const cache = new MeshGPUCache(gpu.device);
    const mesh = cube();
    mesh.indices = null;
    mesh.uvs =
      kind === 'valid'
        ? new Float32Array(mesh.vertexCount * 2).fill(0.5)
        : kind === 'invalid'
        ? new Float32Array([1])
        : null;
    const data = cache.get(1, mesh)!;
    expect(data.indexBuffer).toBeNull();
    expect(data.indexCount).toBe(0);
    expect(data.vertexCount).toBe(mesh.vertexCount);
    expect([...floats(data.uvBuffer)]).toEqual(
      Array(mesh.vertexCount * 2).fill(kind === 'valid' ? 0.5 : 0),
    );
    expect(
      gpu.buffers.filter((buffer) => buffer.usage === BufferUsage.INDEX),
    ).toEqual([]);
    mesh.indices = new Uint32Array();
    cache.invalidate([1]);
    expect(cache.get(1, mesh)!.indexBuffer).toBeNull();
    cache.destroy();
    gpu.scope.dispose();
  },
);

it('reclaims empty/removed geometry and safely reuses an entity id', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  expect(cache.get(1, new Mesh3D())).toBeNull();
  const first = cache.get(1, cube());
  cache.get(2, cube());
  expect(cache.get(1, new Mesh3D())).toBeNull();
  for (const buffer of gpu.buffers.slice(0, 5))
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  cache.retain(new Set([2]));
  for (const buffer of gpu.buffers.slice(5))
    expect(buffer.destroy).not.toHaveBeenCalled();
  expect(cache.get(1, cube())).not.toBe(first);
  cache.destroy();
  for (const buffer of gpu.buffers)
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  gpu.scope.dispose();
});

it.each([0, 1, 2, 3, 4])(
  'rolls back allocation failure at buffer %i and retries the dirty mesh',
  (failAt) => {
    const gpu = fakeMeshGPU();
    const cache = new MeshGPUCache(gpu.device);
    const mesh = cube();
    const previous = cache.get(1, mesh)!;
    cache.invalidate([1]);
    const allocate = gpu.mocks.createBuffer.getMockImplementation()!;
    for (let i = 0; i < failAt; i++)
      gpu.mocks.createBuffer.mockImplementationOnce(allocate);
    gpu.mocks.createBuffer.mockImplementationOnce(() => {
      throw new Error('allocation failed');
    });
    expect(() => cache.get(1, mesh)).toThrow('allocation failed');
    for (const buffer of gpu.buffers.slice(0, 5))
      expect(buffer.destroy).not.toHaveBeenCalled();
    for (const buffer of gpu.buffers.slice(5))
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
    expect(cache.get(1, mesh)).not.toBe(previous);
    cache.destroy();
    for (const buffer of gpu.buffers)
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
    gpu.scope.dispose();
  },
);

it('preserves an allocation failure when rollback also throws', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  const allocate = gpu.mocks.createBuffer.getMockImplementation()!;
  gpu.mocks.createBuffer
    .mockImplementationOnce((descriptor) => {
      const result = allocate(descriptor);
      result.destroy.mockImplementation(() => {
        throw new Error('cleanup failed');
      });
      return result;
    })
    .mockImplementationOnce(() => {
      throw new Error('allocation failed');
    });
  expect(() => cache.get(1, cube())).toThrow('allocation failed');
  expect(gpu.buffers[0].destroy).toHaveBeenCalledTimes(1);
  cache.get(1, cube());
  cache.destroy();
  gpu.scope.dispose();
});

it('attempts every release even if one buffer destroy throws', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  cache.get(1, cube());
  cache.get(2, cube());
  gpu.buffers[0].destroy.mockImplementation(() => {
    throw new Error('cleanup failed');
  });
  expect(() => cache.destroy()).toThrow('Resource cleanup failed');
  expect(() => cache.destroy()).not.toThrow();
  for (const buffer of gpu.buffers)
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  gpu.scope.dispose();
});
