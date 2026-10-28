import { BufferUsage } from '../../packages/device-api/src';
import { Mesh3D } from '../../packages/ecs/src/components/geometry3d/Mesh3D';
import { MeshGPUCache } from '../../packages/ecs/src/systems/mesh3d/mesh-gpu-cache';
import { createGeometry } from '../../packages/ecs/src/utils/geometry3d';
import { buildPathExtrusionMesh } from '../../packages/ecs/src/utils/path-extrusion-mesh';
import { fakeMeshGPU } from './helpers/mesh-gpu';

const cube = () => new Mesh3D(createGeometry({ type: 'cube' }));
const floats = (buffer: unknown) =>
  new Float32Array((buffer as { bytes: Uint8Array }).bytes.buffer);
const buffersPerMesh = 8;

it('reuses buffers across draws, keeps separate model uniforms, and coalesces geometry writes', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  const mesh = cube();
  const first = cache.get(1, mesh)!;
  const second = cache.get(2, mesh)!;
  expect(first.modelUniformBuffer).not.toBe(second.modelUniformBuffer);
  expect(first.vertexBuffer).toBe(second.vertexBuffer);
  for (let i = 0; i < 5; i++) expect(cache.get(1, mesh)).toBe(first);
  expect(gpu.buffers).toHaveLength(buffersPerMesh + 1);
  expect(cache.stats()).toMatchObject({ instances: 2, uniqueGeometries: 1 });
  mesh.positions[0] = 123;
  cache.invalidate([1, 100]);
  cache.invalidate([1]);
  const changed = cache.get(1, mesh)!;
  expect(floats(changed.vertexBuffer)[0]).toBe(123);
  expect(changed.vertexBuffer).not.toBe(second.vertexBuffer);
  expect(cache.get(1, mesh)).toBe(changed);
  expect(cache.get(2, mesh)).toBe(second);
  expect(gpu.buffers).toHaveLength(buffersPerMesh * 2 + 1);
  expect(cache.stats()).toMatchObject({ instances: 2, uniqueGeometries: 2 });
  expect(gpu.buffers[7].destroy).toHaveBeenCalledTimes(1);
  for (const buffer of gpu.buffers.filter((_, index) => index !== 7))
    expect(buffer.destroy).not.toHaveBeenCalled();
  cache.destroy();
  cache.destroy();
  for (const buffer of gpu.buffers)
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  expect(() => cache.get(1, mesh)).toThrow('disposed');
  gpu.scope.dispose();
});

it('shares repeated Path uploads and releases geometry after the last instance', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  const d = 'M0 0 L100 0 L100 100 L0 100 Z';
  const geometry = buildPathExtrusionMesh(d)!.geometry;
  const meshes = Array.from({ length: 20 }, () => new Mesh3D(geometry));
  const data = meshes.map((mesh, index) => cache.get(index, mesh)!);
  expect(new Set(data.map((item) => item.vertexBuffer)).size).toBe(1);
  expect(new Set(data.map((item) => item.modelUniformBuffer)).size).toBe(20);
  expect(gpu.buffers).toHaveLength(7 + 20);
  expect(cache.stats()).toMatchObject({ instances: 20, uniqueGeometries: 1 });
  const geometryBytes = cache.stats().geometryBytes;
  expect(geometryBytes).toBeGreaterThan(0);

  cache.retain(new Set([19]));
  expect(cache.stats()).toMatchObject({
    instances: 1,
    uniqueGeometries: 1,
    geometryBytes,
  });
  expect(data[19].vertexBuffer.destroy).not.toHaveBeenCalled();
  cache.retain(new Set());
  expect(cache.stats()).toMatchObject({
    instances: 0,
    uniqueGeometries: 0,
    geometryBytes: 0,
  });
  for (const buffer of gpu.buffers)
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  cache.destroy();
  gpu.scope.dispose();
});

it('keeps meshes with different normal arrays in separate GPU geometries', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  const original = cube();
  const changed = new Mesh3D({
    positions: original.positions,
    normals: new Float32Array(original.normals).fill(0),
    indices: original.indices,
  });
  const first = cache.get(1, original)!;
  const second = cache.get(2, changed)!;
  expect(first.vertexBuffer).not.toBe(second.vertexBuffer);
  expect(cache.stats()).toMatchObject({ instances: 2, uniqueGeometries: 2 });
  cache.destroy();
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
    mesh.uvs1 =
      kind === 'valid'
        ? new Float32Array(mesh.vertexCount * 2).fill(0.75)
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
    expect([...floats(data.uv1Buffer)]).toEqual(
      Array(mesh.vertexCount * 2).fill(kind === 'valid' ? 0.75 : 0),
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

it('uploads authored tangents and uses zero handedness for missing tangents', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  const mesh = cube();
  const authored = new Float32Array(mesh.vertexCount * 4);
  for (let i = 0; i < authored.length; i += 4) {
    authored[i] = 1;
    authored[i + 3] = i % 8 ? -1 : 1;
  }
  mesh.tangents = authored;
  expect(floats(cache.get(1, mesh)!.tangentBuffer)).toEqual(authored);
  mesh.tangents = new Float32Array([1]);
  cache.invalidate([1]);
  expect(floats(cache.get(1, mesh)!.tangentBuffer)).toEqual(
    new Float32Array(mesh.vertexCount * 4),
  );
  cache.destroy();
  gpu.scope.dispose();
});

it('uploads linear vertex colors and uses white for a mesh without colors', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  const mesh = cube();
  expect(floats(cache.get(1, mesh)!.colorBuffer)).toEqual(
    new Float32Array(mesh.vertexCount * 4).fill(1),
  );
  const colors = new Float32Array(mesh.vertexCount * 4).fill(0.25);
  mesh.colors = colors;
  cache.invalidate([1]);
  expect(floats(cache.get(1, mesh)!.colorBuffer)).toEqual(colors);
  cache.destroy();
  gpu.scope.dispose();
});

it('reclaims empty/removed geometry and safely reuses an entity id', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  expect(cache.get(1, new Mesh3D())).toBeNull();
  const first = cache.get(1, cube());
  cache.get(2, cube());
  expect(cache.get(1, new Mesh3D())).toBeNull();
  for (const buffer of gpu.buffers.slice(0, buffersPerMesh))
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  cache.retain(new Set([2]));
  for (const buffer of gpu.buffers.slice(buffersPerMesh))
    expect(buffer.destroy).not.toHaveBeenCalled();
  expect(cache.get(1, cube())).not.toBe(first);
  cache.destroy();
  for (const buffer of gpu.buffers)
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  gpu.scope.dispose();
});

it.each([0, 1, 2, 3, 4, 5, 6, 7])(
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
    for (const buffer of gpu.buffers.slice(0, buffersPerMesh))
      expect(buffer.destroy).not.toHaveBeenCalled();
    for (const buffer of gpu.buffers.slice(buffersPerMesh))
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

it('preserves a model allocation error when shared geometry rollback throws', () => {
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  const allocate = gpu.mocks.createBuffer.getMockImplementation()!;
  gpu.mocks.createBuffer.mockImplementationOnce((descriptor) => {
    const result = allocate(descriptor);
    result.destroy.mockImplementation(() => {
      throw new Error('cleanup failed');
    });
    return result;
  });
  for (let i = 1; i < 7; i++)
    gpu.mocks.createBuffer.mockImplementationOnce(allocate);
  gpu.mocks.createBuffer.mockImplementationOnce(() => {
    throw new Error('model allocation failed');
  });
  expect(() => cache.get(1, cube())).toThrow('model allocation failed');
  expect(gpu.buffers[0].destroy).toHaveBeenCalledTimes(1);
  expect(cache.stats()).toMatchObject({ instances: 0, uniqueGeometries: 0 });
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
