import { readFileSync } from 'fs';
import path from 'path';
import { parse } from '@loaders.gl/core';
import { GLTFLoader } from '../../packages/ecs/node_modules/@loaders.gl/gltf';
import { Material3D } from '../../packages/ecs/src/components/geometry3d/Material3D';
import { Transform3D } from '../../packages/ecs/src/components/geometry3d/Transform3D';
import type { GltfContainer } from '../../packages/ecs/src/utils/gltf/accessors';
import { bakeGltfMesh } from '../../packages/ecs/src/utils/gltf/bake-gltf-mesh';
import { exportMeshesToGlb } from '../../packages/ecs/src/utils/gltf/export-glb';
import { loadGlbImages } from '../../packages/ecs/src/utils/gltf/load-glb-images';
import { gltfScenes } from '../helpers/gltf';

const model = path.join(
  __dirname,
  '../../packages/site/docs/public/data/NormalTangentTest.glb',
);

const load = async (bytes: Uint8Array) =>
  (await parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    GLTFLoader,
    {
      gltf: {
        loadBuffers: true,
        loadImages: false,
        excludeExtensions: { KHR_texture_transform: false },
      },
    },
  )) as GltfContainer;

it('imports a real Khronos PBR model with its normal, occlusion and two-sided material', async () => {
  const baked = bakeGltfMesh(await load(readFileSync(model)));
  expect(baked.positions.length).toBeGreaterThan(1000);
  expect(baked.map).toMatch(/^data:image\/png;base64,/);
  expect(baked.normalMap).toMatch(/^data:image\/png;base64,/);
  expect(baked.occlusionMap).toMatch(/^data:image\/png;base64,/);
  expect(baked.metallicRoughnessMap).toBe(baked.occlusionMap);
  expect(baked.doubleSided).toBe(true);
  expect(baked.normalScale).toBe(1);
  expect(baked.occlusionStrength).toBe(1);
});

it('keeps the real model material and shared occlusion/PBR image in a GLB round trip', async () => {
  const baked = bakeGltfMesh(await load(readFileSync(model)));
  const source = {
    mesh: baked,
    material: new Material3D(baked),
    transform: new Transform3D(),
  };
  const images = await loadGlbImages([source]);
  expect(images.size).toBe(3);
  const exported = exportMeshesToGlb([source], images);
  const roundTrip = bakeGltfMesh(await load(exported));
  expect(roundTrip.doubleSided).toBe(true);
  expect(roundTrip.normalMap).toMatch(/^data:image\/png;base64,/);
  expect(roundTrip.occlusionMap).toBe(roundTrip.metallicRoughnessMap);
  expect(roundTrip.normalScale).toBe(1);
  expect(roundTrip.occlusionStrength).toBe(1);
});

it('preserves independent normal and occlusion UV transforms and factors', async () => {
  const gltf = await load(readFileSync(model));
  const json = gltf.json as unknown as {
    materials: {
      doubleSided: boolean;
      normalTexture: { index: number; scale?: number; extensions?: object };
      occlusionTexture: {
        index: number;
        strength?: number;
        extensions?: object;
      };
    }[];
  };
  json.materials[0].doubleSided = false;
  json.materials[0].normalTexture.scale = 0.35;
  json.materials[0].normalTexture.extensions = {
    KHR_texture_transform: { offset: [0.2, 0.3], rotation: 0.4 },
  };
  json.materials[0].occlusionTexture.strength = 0.6;
  json.materials[0].occlusionTexture.extensions = {
    KHR_texture_transform: { scale: [0.5, 2] },
  };
  const baked = bakeGltfMesh(gltf);
  expect(baked.doubleSided).toBe(false);
  expect(baked.normalScale).toBeCloseTo(0.35);
  expect(baked.occlusionStrength).toBeCloseTo(0.6);
  expect(baked.normalTextureTransform).toEqual({
    offset: [0.2, 0.3],
    scale: [1, 1],
    rotation: 0.4,
  });
  expect(baked.occlusionTextureTransform).toEqual({
    offset: [0, 0],
    scale: [0.5, 2],
    rotation: 0,
  });
  const source = {
    mesh: baked,
    material: new Material3D(baked),
    transform: new Transform3D(),
  };
  const exported = exportMeshesToGlb([source], await loadGlbImages([source]));
  const reloaded = await load(exported);
  const roundTrip = bakeGltfMesh(reloaded);
  expect(roundTrip.doubleSided).toBe(false);
  expect(roundTrip.normalScale).toBeCloseTo(0.35);
  expect(roundTrip.occlusionStrength).toBeCloseTo(0.6);
  expect(roundTrip.normalTextureTransform).toEqual(
    baked.normalTextureTransform,
  );
  expect(roundTrip.occlusionTextureTransform).toEqual(
    baked.occlusionTextureTransform,
  );
});

it('ignores a normal or occlusion texture when its second UV set is missing', async () => {
  const gltf = await load(readFileSync(model));
  const json = gltf.json as unknown as {
    materials: {
      normalTexture: { texCoord?: number };
      occlusionTexture: { texCoord?: number };
    }[];
  };
  json.materials[0].normalTexture.texCoord = 1;
  json.materials[0].occlusionTexture.texCoord = 1;
  const baked = bakeGltfMesh(gltf);
  expect(baked.normalMap).toBeNull();
  expect(baked.occlusionMap).toBeNull();
});

it('transforms authored, strided TANGENT vectors and flips handedness for a mirrored node', async () => {
  const gltf = gltfScenes();
  const json = gltf.json as unknown as {
    accessors: {
      bufferView: number;
      componentType: number;
      count: number;
      type: string;
    }[];
    bufferViews: { buffer: number; byteLength: number; byteStride?: number }[];
    meshes: { primitives: { attributes: { TANGENT?: number } }[] }[];
    nodes: { scale?: number[] }[];
  };
  const interleaved = new Float32Array([
    1, 0, 0, 1, 99, 1, 0, 0, -1, 99, 1, 0, 0, 1, 99,
  ]);
  gltf.buffers.push({ arrayBuffer: interleaved.buffer });
  json.bufferViews.push({
    buffer: 1,
    byteLength: interleaved.byteLength,
    byteStride: 20,
  });
  json.accessors.push({
    bufferView: 1,
    componentType: 5126,
    count: 3,
    type: 'VEC4',
  });
  json.meshes[0].primitives[0].attributes.TANGENT = 1;
  json.nodes[0].scale = [-2, 1, 1];

  const baked = bakeGltfMesh(gltf);
  expect(baked.tangents).toEqual(
    new Float32Array([-1, 0, 0, -1, -1, 0, 0, 1, -1, 0, 0, -1]),
  );
  expect(baked.parts[0].tangents).toEqual(baked.tangents);

  const exported = exportMeshesToGlb([
    {
      mesh: baked,
      material: new Material3D(baked),
      transform: new Transform3D(),
    },
  ]);
  const reloaded = await load(exported);
  const primitive = (
    reloaded.json as unknown as {
      meshes: { primitives: { attributes: { TANGENT?: number } }[] }[];
    }
  ).meshes[0].primitives[0];
  expect(primitive.attributes.TANGENT).toBeDefined();
  expect(bakeGltfMesh(reloaded).tangents).toEqual(baked.tangents);

  const scenes = (json as unknown as { scenes: { nodes: number[] }[] }).scenes;
  scenes[0].nodes.push(1);
  const mixed = bakeGltfMesh(gltf);
  expect(mixed.tangents).toBeUndefined();
  expect(mixed.parts[0].tangents).toEqual(baked.tangents);
  expect(mixed.parts[1].tangents).toBeUndefined();
});
