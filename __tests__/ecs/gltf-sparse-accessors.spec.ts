import { parse } from '@loaders.gl/core';
import { GLTFLoader } from '../../packages/ecs/node_modules/@loaders.gl/gltf';
import { Material3D } from '../../packages/ecs/src/components/geometry3d/Material3D';
import { Transform3D } from '../../packages/ecs/src/components/geometry3d/Transform3D';
import {
  readAccessor,
  type GltfContainer,
} from '../../packages/ecs/src/utils/gltf/accessors';
import { bakeGltfMesh } from '../../packages/ecs/src/utils/gltf/bake-gltf-mesh';
import { exportMeshesToGlb } from '../../packages/ecs/src/utils/gltf/export-glb';
import { gltfScenes } from '../helpers/gltf';

it('loads a sparse-only POSITION accessor through the glTF loader and exports its mesh', async () => {
  const bytes = new Uint8Array(28);
  bytes.set([1, 2]);
  bytes.set(new Uint8Array(new Float32Array([2, 0, 0, 0, 1, 0]).buffer), 4);
  const json = {
    asset: { version: '2.0' },
    buffers: [
      {
        uri: `data:application/octet-stream;base64,${Buffer.from(
          bytes,
        ).toString('base64')}`,
        byteLength: bytes.length,
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 2 },
      { buffer: 0, byteOffset: 4, byteLength: 24 },
    ],
    accessors: [
      {
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        sparse: {
          count: 2,
          indices: { bufferView: 0, componentType: 5121 },
          values: { bufferView: 1 },
        },
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  const gltf = (await parse(JSON.stringify(json), GLTFLoader, {
    gltf: { loadBuffers: true, loadImages: false },
  })) as GltfContainer;
  expect([...readAccessor(gltf, 0).array]).toEqual([0, 0, 0, 2, 0, 0, 0, 1, 0]);

  const baked = bakeGltfMesh(gltf);
  expect([...baked.indices]).toEqual([0, 1, 2]);
  expect(baked.positions.length).toBe(9);
  expect(baked.normals[2]).toBeCloseTo(1);
  const exported = exportMeshesToGlb([
    {
      mesh: baked,
      material: new Material3D(baked),
      transform: new Transform3D(),
    },
  ]);
  const roundTrip = (await parse(exported, GLTFLoader, {
    gltf: { loadBuffers: true, loadImages: false },
  })) as GltfContainer;
  const reimported = bakeGltfMesh(roundTrip);
  expect(reimported.positions.length).toBe(baked.positions.length);
  for (let i = 0; i < baked.positions.length; i += 3) {
    expect(reimported.positions[i]).toBeCloseTo(baked.positions[i]);
    // GLB export changes canvas-down Y to glTF-up Y.
    expect(reimported.positions[i + 1]).toBeCloseTo(-baked.positions[i + 1]);
    expect(reimported.positions[i + 2]).toBeCloseTo(baked.positions[i + 2]);
  }
});

it.each([false, true])(
  'patches a dense accessor (interleaved=%s) without changing the source buffer',
  (interleaved) => {
    const dense = new Float32Array(
      interleaved
        ? [0, 0, 0, 99, 1, 0, 0, 99, 0, 1, 0, 99]
        : [0, 0, 0, 1, 0, 0, 0, 1, 0],
    );
    const original = [...dense];
    const sparseIndex = new Uint16Array([1]);
    const sparseValue = new Float32Array([2, 3, 4]);
    const gltf: GltfContainer = {
      json: {
        accessors: [
          {
            bufferView: 0,
            componentType: 5126,
            count: 3,
            type: 'VEC3',
            sparse: {
              count: 1,
              indices: { bufferView: 1, componentType: 5123 },
              values: { bufferView: 2 },
            },
          },
        ],
        bufferViews: [
          {
            buffer: 0,
            byteLength: dense.byteLength,
            ...(interleaved ? { byteStride: 16 } : {}),
          },
          { buffer: 1, byteLength: sparseIndex.byteLength },
          { buffer: 2, byteLength: sparseValue.byteLength },
        ],
      },
      buffers: [
        { arrayBuffer: dense.buffer },
        { arrayBuffer: sparseIndex.buffer },
        { arrayBuffer: sparseValue.buffer },
      ],
    };
    expect([...readAccessor(gltf, 0).array]).toEqual([
      0, 0, 0, 2, 3, 4, 0, 1, 0,
    ]);
    expect([...dense]).toEqual(original);
  },
);

it('applies normalized sparse COLOR_0 values before vertex-color import', () => {
  const gltf = gltfScenes();
  const json = gltf.json as unknown as {
    accessors: Record<string, unknown>[];
    bufferViews: Record<string, unknown>[];
    meshes: { primitives: { attributes: { COLOR_0?: number } }[] }[];
  };
  const dense = new Uint8Array(12).fill(255);
  const sparseIndex = new Uint8Array([1]);
  const sparseValue = new Uint8Array([128, 64, 255, 128]);
  const start = gltf.buffers.length;
  gltf.buffers.push(
    { arrayBuffer: dense.buffer },
    { arrayBuffer: sparseIndex.buffer },
    { arrayBuffer: sparseValue.buffer },
  );
  const view = json.bufferViews.length;
  json.bufferViews.push(
    { buffer: start, byteLength: dense.byteLength },
    { buffer: start + 1, byteLength: sparseIndex.byteLength },
    { buffer: start + 2, byteLength: sparseValue.byteLength },
  );
  json.meshes[0].primitives[0].attributes.COLOR_0 = json.accessors.length;
  json.accessors.push({
    bufferView: view,
    componentType: 5121,
    count: 3,
    type: 'VEC4',
    normalized: true,
    sparse: {
      count: 1,
      indices: { bufferView: view + 1, componentType: 5121 },
      values: { bufferView: view + 2 },
    },
  });

  const baked = bakeGltfMesh(gltf);
  expect([...baked.colors!]).toEqual([
    1,
    1,
    1,
    1,
    expect.closeTo(128 / 255, 6),
    expect.closeTo(64 / 255, 6),
    1,
    expect.closeTo(128 / 255, 6),
    1,
    1,
    1,
    1,
  ]);
  expect([...dense]).toEqual(new Array(12).fill(255));
});

it('reads sparse index accessors and rejects invalid sparse offsets', () => {
  const dense = new Uint16Array([0, 1, 2]);
  const indices = new Uint8Array([1, 2]);
  const values = new Uint16Array([2, 1]);
  const gltf = gltfScenes();
  const json = gltf.json as unknown as {
    accessors: Record<string, unknown>[];
    bufferViews: Record<string, unknown>[];
    meshes: { primitives: { indices?: number }[] }[];
  };
  const buffer = gltf.buffers.length;
  gltf.buffers.push(
    { arrayBuffer: dense.buffer },
    { arrayBuffer: indices.buffer },
    { arrayBuffer: values.buffer },
  );
  const view = json.bufferViews.length;
  json.bufferViews.push(
    { buffer, byteLength: dense.byteLength },
    { buffer: buffer + 1, byteLength: indices.byteLength },
    { buffer: buffer + 2, byteLength: values.byteLength },
  );
  const accessor = json.accessors.length;
  json.accessors.push({
    bufferView: view,
    componentType: 5123,
    count: 3,
    type: 'SCALAR',
    sparse: {
      count: 2,
      indices: { bufferView: view + 1, componentType: 5121 },
      values: { bufferView: view + 2 },
    },
  });
  json.meshes[0].primitives[0].indices = accessor;

  expect([...readAccessor(gltf, accessor).array]).toEqual([0, 2, 1]);
  expect([...bakeGltfMesh(gltf).indices]).toEqual([0, 2, 1]);
  expect([...dense]).toEqual([0, 1, 2]);
  indices[1] = 3;
  expect(() => readAccessor(gltf, accessor)).toThrow(
    'Invalid glTF sparse accessor index',
  );
});
