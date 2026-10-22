import { readFileSync } from 'fs';
import path from 'path';
import { bakeGltfMesh } from '../../packages/ecs/src/utils/gltf/bake-gltf-mesh';
import { exportMeshesToGlb } from '../../packages/ecs/src/utils/gltf/export-glb';
import { Material3D } from '../../packages/ecs/src/components/geometry3d/Material3D';
import { Transform3D } from '../../packages/ecs/src/components/geometry3d/Transform3D';
import { parse } from '@loaders.gl/core';
import { GLTFLoader } from '../../packages/ecs/node_modules/@loaders.gl/gltf';
import type { GltfContainer } from '../../packages/ecs/src/utils/gltf/accessors';
import { gltfScenes } from '../helpers/gltf';

const dataDir = path.join(__dirname, '../../packages/site/docs/public/data');
const importedPrimaryColor = [
  expect.closeTo(0.4845292, 6),
  expect.closeTo(0.6651851, 6),
  expect.closeTo(0.7977377, 6),
  0.8,
];
const importedSecondaryColor = [
  expect.closeTo(0.9063318, 6),
  expect.closeTo(0.7977377, 6),
  expect.closeTo(0.6651851, 6),
  1,
];

function loadDuckContainer(): GltfContainer {
  const json = JSON.parse(
    readFileSync(path.join(dataDir, 'Duck.gltf'), 'utf8'),
  );
  const bin = readFileSync(path.join(dataDir, 'Duck0.bin'));
  return {
    json,
    buffers: [
      {
        arrayBuffer: bin.buffer.slice(
          bin.byteOffset,
          bin.byteOffset + bin.byteLength,
        ),
      },
    ],
  };
}

describe('gltf duck mesh', () => {
  it('bakes Duck.gltf with positions and indices', () => {
    const mesh = bakeGltfMesh(loadDuckContainer(), {
      baseUrl: '/data/Duck.gltf',
    });
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.normals.length).toBe(mesh.positions.length);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.positions.length % 3).toBe(0);
    expect(mesh.uvs?.length).toBe((mesh.positions.length / 3) * 2);
    expect(mesh.map).toBe('/data/DuckCM.png');
  });

  it('normalizes duck bounds to roughly unit size', () => {
    const mesh = bakeGltfMesh(loadDuckContainer());
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      minX = Math.min(minX, mesh.positions[i]);
      maxX = Math.max(maxX, mesh.positions[i]);
      minY = Math.min(minY, mesh.positions[i + 1]);
      maxY = Math.max(maxY, mesh.positions[i + 1]);
      minZ = Math.min(minZ, mesh.positions[i + 2]);
      maxZ = Math.max(maxZ, mesh.positions[i + 2]);
    }
    const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    expect(extent).toBeGreaterThan(0.9);
    expect(extent).toBeLessThanOrEqual(1.01);
    expect(Math.abs(minX + maxX)).toBeLessThan(0.05);
    expect(Math.abs(minY + maxY)).toBeLessThan(0.05);
    expect(Math.abs(minZ + maxZ)).toBeLessThan(0.05);
  });
});

it('normalizes glTF scene primitives together so their relative placement survives', () => {
  const model = gltfScenes();
  const scenes = (model.json as unknown as { scenes: { nodes: number[] }[] })
    .scenes;
  scenes[0].nodes.push(1);
  const mesh = bakeGltfMesh(model, { scene: 0 });
  expect(mesh.parts).toHaveLength(2);
  expect(mesh.parts[0].baseColor).toEqual(importedPrimaryColor);
  expect(mesh.parts[1].baseColor).toEqual(importedSecondaryColor);
  expect(mesh.parts[0].metallic).toBe(1);
  expect(mesh.parts[0].roughness).toBe(1);
  expect(mesh.parts[0].positions[7]).toBeCloseTo(0);
  expect(mesh.parts[1].positions[7]).toBeCloseTo(0.5);
  expect(mesh.parts[0].indices).toEqual(new Uint32Array([0, 1, 2]));
  expect(mesh.parts[1].indices).toEqual(new Uint32Array([0, 1, 2]));
});

it.each([
  {
    mode: 4,
    indexed: true,
    mirrored: true,
    order: [0, 1, 2],
    triangles: [0, 2, 1],
  },
  {
    mode: 5,
    indexed: false,
    mirrored: false,
    order: [0, 1, 2, 3],
    triangles: [0, 1, 2, 2, 1, 3],
  },
  {
    mode: 5,
    indexed: true,
    mirrored: true,
    order: [0, 1, 2, 3],
    triangles: [0, 2, 1, 2, 3, 1],
  },
  {
    mode: 6,
    indexed: false,
    mirrored: false,
    order: [0, 1, 3, 2],
    triangles: [0, 1, 2, 0, 2, 3],
  },
  {
    mode: 6,
    indexed: true,
    mirrored: true,
    order: [0, 1, 3, 2],
    triangles: [0, 3, 1, 0, 2, 3],
  },
])(
  'imports glTF mode $mode (indexed=$indexed, mirrored=$mirrored) and exports triangles',
  async ({ mode, indexed, mirrored, order, triangles }) => {
    const corners = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ];
    const positions = new Float32Array(
      (indexed ? corners : order.map((index) => corners[index])).flat(),
    );
    const sourceIndices = new Uint16Array(order);
    const json = {
      accessors: [
        { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3' },
        {
          bufferView: 1,
          componentType: 5123,
          count: sourceIndices.length,
          type: 'SCALAR',
        },
      ],
      bufferViews: [
        { buffer: 0, byteLength: positions.byteLength },
        { buffer: 1, byteLength: sourceIndices.byteLength },
      ],
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, scale: mirrored ? [-1, 1, 1] : [1, 1, 1] }],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0 },
              mode,
              ...(indexed ? { indices: 1 } : {}),
            },
          ],
        },
      ],
    };
    const gltf: GltfContainer = {
      json,
      buffers: [
        { arrayBuffer: positions.buffer },
        { arrayBuffer: sourceIndices.buffer },
      ],
    };

    const baked = bakeGltfMesh(gltf);
    expect([...baked.indices]).toEqual(triangles);
    expect([...baked.parts[0].indices]).toEqual(triangles);
    for (let i = 2; i < baked.normals.length; i += 3)
      expect(baked.normals[i]).toBeCloseTo(1);

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
    expect([...bakeGltfMesh(roundTrip).indices]).toEqual(triangles);
  },
);

it('reads and clamps glTF PBR factors for each primitive', () => {
  const model = gltfScenes();
  const json = model.json as unknown as {
    materials: {
      pbrMetallicRoughness: {
        metallicFactor?: number;
        roughnessFactor?: number;
        metallicRoughnessTexture?: { index: number; texCoord?: number };
      };
    }[];
    textures: { source: number }[];
    images: { uri: string }[];
    scenes: { nodes: number[] }[];
  };
  const materials = json.materials;
  materials[0].pbrMetallicRoughness.metallicFactor = 0.25;
  materials[0].pbrMetallicRoughness.roughnessFactor = 0.7;
  materials[1].pbrMetallicRoughness.metallicFactor = -1;
  materials[1].pbrMetallicRoughness.roughnessFactor = 2;
  json.images.push({ uri: 'surface.png' });
  json.textures.push({ source: 1 });
  materials[0].pbrMetallicRoughness.metallicRoughnessTexture = { index: 1 };
  json.scenes[0].nodes.push(1);
  const mesh = bakeGltfMesh(model, { baseUrl: '/data/model.gltf' });
  expect([mesh.metallic, mesh.roughness]).toEqual([0.25, 0.7]);
  expect(
    mesh.parts.map(({ metallic, roughness }) => [metallic, roughness]),
  ).toEqual([
    [0.25, 0.7],
    [0, 1],
  ]);
  expect(mesh.parts[0].metallicRoughnessMap).toBe('/data/surface.png');
  expect(mesh.parts[1].metallicRoughnessMap).toBeNull();
  materials[0].pbrMetallicRoughness.metallicRoughnessTexture!.texCoord = 1;
  expect(bakeGltfMesh(model).metallicRoughnessMap).toBeNull();
});

it('imports TEXCOORD_1 for a base-color texture independently of the PBR map', () => {
  const model = gltfScenes();
  const uv1 = new Float32Array([0.25, 0.5, 0.75, 0.5, 0.25, 0.9]);
  const json = model.json as unknown as {
    accessors: Record<string, unknown>[];
    bufferViews: Record<string, unknown>[];
    meshes: { primitives: { attributes: { TEXCOORD_1?: number } }[] }[];
    materials: {
      pbrMetallicRoughness: {
        baseColorTexture?: {
          index: number;
          texCoord?: number;
          extensions?: { KHR_texture_transform: Record<string, unknown> };
        };
        metallicRoughnessTexture?: {
          index: number;
          texCoord?: number;
          extensions?: { KHR_texture_transform: Record<string, unknown> };
        };
      };
    }[];
  };
  json.bufferViews.push({
    buffer: model.buffers.length,
    byteLength: uv1.byteLength,
  });
  json.accessors.push({
    bufferView: json.bufferViews.length - 1,
    componentType: 5126,
    count: 3,
    type: 'VEC2',
  });
  model.buffers.push({ arrayBuffer: uv1.buffer });
  json.meshes[0].primitives[0].attributes.TEXCOORD_1 =
    json.accessors.length - 1;
  json.materials[0].pbrMetallicRoughness.baseColorTexture!.extensions = {
    KHR_texture_transform: {
      texCoord: 1,
      offset: [0.25, 0.5],
      scale: [2, 0.5],
      rotation: Math.PI / 2,
    },
  };
  json.materials[0].pbrMetallicRoughness.metallicRoughnessTexture = {
    index: 0,
    extensions: {
      KHR_texture_transform: { offset: [0.75, 0] },
    },
  };
  const baked = bakeGltfMesh(model, { baseUrl: '/data/model.gltf' });
  expect(baked.mapTexCoord).toBe(1);
  expect(baked.metallicRoughnessTexCoord).toBe(0);
  expect(baked.map).toBe('/data/albedo.png');
  expect(baked.metallicRoughnessMap).toBe('/data/albedo.png');
  expect(baked.mapTextureTransform).toEqual({
    offset: [0.25, 0.5],
    scale: [2, 0.5],
    rotation: Math.PI / 2,
  });
  expect(baked.metallicRoughnessTextureTransform).toEqual({
    offset: [0.75, 0],
    scale: [1, 1],
    rotation: 0,
  });
  expect(baked.parts[0].uvs1).toEqual(uv1);
  expect(baked.uvs1).toEqual(uv1);
});

it('decodes normalized integer TEXCOORD_1 with an interleaved stride', () => {
  const model = gltfScenes();
  const bytes = new ArrayBuffer(3 * 8);
  const view = new DataView(bytes);
  const expected = [0, 1, 1, 0, 0.5, 0.5];
  for (let i = 0; i < expected.length; i++)
    view.setUint16(
      Math.floor(i / 2) * 8 + (i % 2) * 2,
      Math.round(expected[i] * 65535),
      true,
    );
  const json = model.json as unknown as {
    accessors: Record<string, unknown>[];
    bufferViews: Record<string, unknown>[];
    meshes: { primitives: { attributes: { TEXCOORD_1?: number } }[] }[];
    materials: {
      pbrMetallicRoughness: {
        baseColorTexture: { texCoord?: number };
      };
    }[];
  };
  json.bufferViews.push({
    buffer: model.buffers.length,
    byteLength: bytes.byteLength,
    byteStride: 8,
  });
  json.accessors.push({
    bufferView: json.bufferViews.length - 1,
    componentType: 5123,
    count: 3,
    type: 'VEC2',
    normalized: true,
  });
  model.buffers.push({ arrayBuffer: bytes });
  json.meshes[0].primitives[0].attributes.TEXCOORD_1 =
    json.accessors.length - 1;
  json.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord = 1;
  const baked = bakeGltfMesh(model, { baseUrl: '/data/model.gltf' });
  baked.uvs1?.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 4));
});

it('imports per-primitive emissive factors, textures and their UV transform', () => {
  const model = gltfScenes();
  const json = model.json as unknown as {
    scenes: { nodes: number[] }[];
    materials: {
      emissiveFactor?: number[];
      extensions?: {
        KHR_materials_emissive_strength: { emissiveStrength: number };
        KHR_materials_unlit?: Record<string, never>;
      };
      emissiveTexture?: {
        index: number;
        extensions?: {
          KHR_texture_transform: { offset: number[]; rotation: number };
        };
      };
    }[];
  };
  json.scenes[0].nodes.push(1);
  json.materials[0].emissiveFactor = [0.5, 0.25, 0.1];
  json.materials[0].extensions = {
    KHR_materials_emissive_strength: { emissiveStrength: 2 },
    KHR_materials_unlit: {},
  };
  json.materials[0].emissiveTexture = {
    index: 0,
    extensions: {
      KHR_texture_transform: { offset: [0.25, 0.5], rotation: 0.3 },
    },
  };
  const baked = bakeGltfMesh(model, { baseUrl: '/data/model.gltf' });
  expect(baked.parts[0].emissiveFactor).toEqual([0.5, 0.25, 0.1]);
  expect(baked.parts[0].emissiveStrength).toBe(2);
  expect(baked.parts[0].unlit).toBe(true);
  expect(baked.parts[0].baseColor[0]).toBeCloseTo(0.4845, 4);
  expect(baked.parts[0].baseColor[3]).toBe(0.8);
  expect(baked.parts[0].emissiveMap).toBe('/data/albedo.png');
  expect(baked.parts[0].emissiveTextureTransform).toEqual({
    offset: [0.25, 0.5],
    scale: [1, 1],
    rotation: 0.3,
  });
  expect(baked.parts[1].emissiveFactor).toEqual([0, 0, 0]);
  expect(baked.parts[1].emissiveStrength).toBe(1);
  expect(baked.parts[1].unlit).toBe(false);
  expect(baked.parts[1].baseColor).toEqual(importedSecondaryColor);
  expect(baked.parts[1].emissiveMap).toBeNull();
});
