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
