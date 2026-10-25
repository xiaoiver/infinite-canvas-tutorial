import { mat4 } from 'gl-matrix';
import type { Buffer } from '../../packages/device-api/src';
import { Material3D } from '../../packages/ecs/src/components/geometry3d/Material3D';
import { Transform3D } from '../../packages/ecs/src/components/geometry3d/Transform3D';
import {
  MESH_MODEL_UNIFORM_FLOATS,
  MeshModelUniforms,
} from '../../packages/ecs/src/systems/mesh3d/mesh-model-uniforms';
import { ENVIRONMENT_IRRADIANCE_FLOATS } from '../../packages/ecs/src/utils/environment-irradiance';

const ready = {
  mapReady: false,
  metallicRoughnessMapReady: false,
  emissiveMapReady: false,
  normalMapReady: false,
  occlusionMapReady: false,
  specularMapReady: false,
  bumpMapReady: false,
  environmentMapReady: false,
  environmentIrradiance: null,
};
const shadowOffset = 60 + ENVIRONMENT_IRRADIANCE_FLOATS;
const textureCoordOffset = shadowOffset + 4;
function setup() {
  const bytes = new Uint8Array(MESH_MODEL_UNIFORM_FLOATS * 4);
  const setSubData = jest.fn((offset: number, data: Uint8Array) =>
    bytes.set(data, offset),
  );
  const uniforms = new MeshModelUniforms({ setSubData } as unknown as Buffer);
  const transform = new Transform3D();
  const material = new Material3D();
  return {
    uniforms,
    transform,
    material,
    setSubData,
    data: new Float32Array(bytes.buffer),
  };
}
afterEach(() => jest.restoreAllMocks());

it('reuses matrices and uploads across idle frames and equivalent component objects', () => {
  const { uniforms, transform, material, setSubData, data } = setup();
  const invert = jest.spyOn(mat4, 'invert');
  const first = uniforms.update(transform, material, ready);
  expect([...data.slice(0, 16)]).toEqual([...mat4.create()]);
  for (let i = 0; i < 5; i++)
    expect(uniforms.update(new Transform3D(), new Material3D(), ready)).toBe(
      first,
    );
  // Non-exact Float32 values such as ambient=0.1 must not cause repeat uploads.
  expect(setSubData).toHaveBeenCalledTimes(1);
  expect(invert).toHaveBeenCalledTimes(1);
  expect([...data.slice(40, 44)]).toEqual(
    [-0.5, -0.7, -0.5, 0].map(Math.fround),
  );
});

it('detects in-place translation, rotation and flipped scale, and resets a singular normal matrix', () => {
  const { uniforms, transform, material, setSubData, data } = setup();
  uniforms.update(transform, material, ready);
  transform.translation[0] = 17;
  transform.rotation[2] = Math.PI / 2;
  transform.scale[0] = -2;
  uniforms.update(transform, material, ready);
  expect(data[12]).toBe(17);
  expect(data[1]).toBeCloseTo(-2);
  expect(data[4]).toBeCloseTo(-1);
  expect([...data.slice(44, 48)]).toEqual([17, 0, 0, 0]);
  const product = mat4.multiply(
    mat4.create(),
    mat4.transpose(mat4.create(), data.slice(16, 32)),
    data.slice(0, 16),
  );
  for (let i = 0; i < 16; i++)
    expect(product[i]).toBeCloseTo(i % 5 === 0 ? 1 : 0);
  transform.scale[1] = 0;
  uniforms.update(transform, material, ready);
  expect([...data.slice(16, 32)]).toEqual([...mat4.create()]);
  expect(setSubData).toHaveBeenCalledTimes(3);
});

it('updates all material inputs and late texture readiness without rebuilding matrices', () => {
  const { uniforms, transform, material, data, setSubData } = setup();
  const invert = jest.spyOn(mat4, 'invert');
  uniforms.update(transform, material, ready);
  material.baseColor[0] = 0.25;
  Object.assign(material, {
    ambient: 0.2,
    diffuse: 0.4,
    specular: 0.6,
    shininess: 4,
    bumpScale: 2,
    metallic: 0.3,
    roughness: 0.8,
  });
  const textures = {
    mapReady: true,
    metallicRoughnessMapReady: true,
    emissiveMapReady: true,
    normalMapReady: false,
    occlusionMapReady: false,
    specularMapReady: true,
    bumpMapReady: true,
    environmentMapReady: true,
    environmentIrradiance: Float32Array.from({ length: 36 }, (_, i) =>
      i === 0 ? 0.7 : 0,
    ),
  };
  const legacy = uniforms.update(transform, material, textures);
  expect([...data.slice(32, 40)]).toEqual(
    [0.25, 1, 1, 1, 0.2, 0.4, 0.6, 4].map(Math.fround),
  );
  expect([...data.slice(48, 56)]).toEqual(
    [1, 1, 1, 2, 0.3, 0.8, 0, 1].map(Math.fround),
  );
  expect(data[60]).toBeCloseTo(0.7);
  expect(data[shadowOffset + 3]).toBe(1);
  expect(legacy.u_MaterialFlags).toEqual(data.slice(48, 52));
  uniforms.update(transform, material, textures);
  expect(setSubData).toHaveBeenCalledTimes(2);
  uniforms.update(transform, material, ready);
  expect([...data.slice(48, 51)]).toEqual([0, 0, 0]);
  expect(data[55]).toBe(0);
  expect(data[60]).toBe(0);
  expect(data[shadowOffset + 3]).toBe(0);
  expect(setSubData).toHaveBeenCalledTimes(3);
  expect(invert).toHaveBeenCalledTimes(1);
});

it('uploads an optional side-wall color without rebuilding geometry or pose', () => {
  const { uniforms, transform, material, data, setSubData } = setup();
  const invert = jest.spyOn(mat4, 'invert');
  uniforms.update(transform, material, ready);
  material.sideColor = [0.2, 0.4, 0.6, 0.8];
  uniforms.update(transform, material, ready);
  expect(data[54]).toBe(1);
  expect([...data.slice(56, 60)]).toEqual(
    [0.2, 0.4, 0.6, 0.8].map(Math.fround),
  );
  uniforms.update(transform, material, ready);
  expect(setSubData).toHaveBeenCalledTimes(2);
  expect(invert).toHaveBeenCalledTimes(1);
  material.sideColor = null;
  uniforms.update(transform, material, ready);
  expect(data[54]).toBe(0);
  expect(setSubData).toHaveBeenCalledTimes(3);
});

it('updates the receiver flag when shadow reception changes', () => {
  const { uniforms, transform, material, data, setSubData } = setup();
  const receiveOffset = shadowOffset;
  uniforms.update(transform, material, ready);
  expect(data[receiveOffset]).toBe(1);
  material.receiveShadow = false;
  const legacy = uniforms.update(transform, material, ready);
  expect(data[receiveOffset]).toBe(0);
  expect(legacy.u_ShadowReceive).toEqual(
    data.slice(receiveOffset, receiveOffset + 4),
  );
  uniforms.update(transform, material, ready);
  expect(setSubData).toHaveBeenCalledTimes(2);
});

it('keeps alpha mode, cutoff and map readiness current before the shadow pass', () => {
  const { uniforms, transform, material, data } = setup();
  const offset = shadowOffset;
  material.alphaMode = 'mask';
  material.mapTexCoord = 1;
  material.alphaCutoff = 0.35;
  material.baseColor = [1, 1, 1, 0.8];
  uniforms.updateShadowMaterial(transform, material, true);
  expect(data[35]).toBeCloseTo(0.8);
  expect(data[48]).toBe(1);
  expect(data[textureCoordOffset]).toBe(1);
  expect([...data.slice(offset + 1, offset + 3)]).toEqual([
    1,
    Math.fround(0.35),
  ]);
  material.alphaMode = 'blend';
  uniforms.update(transform, material, ready);
  expect(data[offset + 1]).toBe(2);
  material.alphaMode = 'opaque';
  uniforms.updateShadowMaterial(transform, material, false);
  expect(data[offset + 1]).toBe(0);
  expect(data[48]).toBe(0);
  material.alphaCutoff = Number.NaN;
  uniforms.updateShadowMaterial(transform, material, false);
  expect(data[offset + 2]).toBe(0.5);
});

it('tracks independent base-color and PBR UV selectors', () => {
  const { uniforms, transform, material, data } = setup();
  material.mapTexCoord = 1;
  material.metallicRoughnessTexCoord = 0;
  const legacy = uniforms.update(transform, material, ready);
  expect([...data.slice(textureCoordOffset, textureCoordOffset + 4)]).toEqual([
    1, 0, 0, 0,
  ]);
  expect(legacy.u_TextureCoords).toEqual(
    data.slice(textureCoordOffset, textureCoordOffset + 4),
  );
  material.metallicRoughnessTexCoord = 1;
  uniforms.update(transform, material, ready);
  expect(data[textureCoordOffset + 1]).toBe(1);
});

it('uploads distinct texture transforms and refreshes mask UVs before the shadow pass', () => {
  const { uniforms, transform, material, data } = setup();
  material.mapTextureTransform = {
    offset: [0.25, 0.5],
    scale: [2, 3],
    rotation: Math.PI / 2,
  };
  material.metallicRoughnessTextureTransform = {
    offset: [0.75, 0],
    scale: [0.5, 1],
    rotation: -0.5,
  };
  const legacy = uniforms.update(transform, material, ready);
  expect(legacy.u_MapUvTransform).toEqual(Float32Array.of(0.25, 0.5, 2, 3));
  expect(legacy.u_PbrUvTransform).toEqual(Float32Array.of(0.75, 0, 0.5, 1));
  expect(legacy.u_UvRotations).toEqual(
    Float32Array.of(Math.fround(Math.PI / 2), -0.5, 0, 0),
  );
  material.mapTextureTransform = { offset: [0.5, 0.25] };
  uniforms.updateShadowMaterial(transform, material, true);
  expect([
    ...data.slice(textureCoordOffset + 4, textureCoordOffset + 8),
  ]).toEqual([0.5, 0.25, 1, 1]);
  expect(data[textureCoordOffset + 12]).toBe(0);
});

it('uploads emissive color, texture readiness and its independent UV transform', () => {
  const { uniforms, transform, material, data, setSubData } = setup();
  material.emissiveFactor = [0.2, 0.4, 0.6];
  material.emissiveStrength = 3;
  material.unlit = true;
  material.emissiveTexCoord = 1;
  material.emissiveTextureTransform = {
    offset: [0.25, 0.5],
    scale: [2, 0.5],
    rotation: 0.3,
  };
  const legacy = uniforms.update(transform, material, {
    ...ready,
    emissiveMapReady: true,
  });
  expect(legacy.u_EmissiveFactor).toEqual(Float32Array.of(0.2, 0.4, 0.6, 1));
  expect(legacy.u_EmissiveUvTransform).toEqual(
    Float32Array.of(0.25, 0.5, 2, 0.5),
  );
  expect(legacy.u_EmissiveParams).toEqual(Float32Array.of(1, 0.3, 3, 1));
  uniforms.update(transform, material, { ...ready, emissiveMapReady: true });
  expect(setSubData).toHaveBeenCalledTimes(1);
  uniforms.update(transform, material, ready);
  expect(data[83 + ENVIRONMENT_IRRADIANCE_FLOATS]).toBe(0);
});

it('uploads double-sided, normal and occlusion settings without rebuilding geometry', () => {
  const { uniforms, transform, material, setSubData } = setup();
  material.doubleSided = true;
  material.normalTexCoord = 1;
  material.normalScale = 0.5;
  material.normalTextureTransform = { offset: [0.25, 0.5], rotation: 0.3 };
  material.occlusionTexCoord = 0;
  material.occlusionStrength = 0.7;
  material.occlusionTextureTransform = { scale: [2, 0.5], rotation: -0.2 };
  const legacy = uniforms.update(transform, material, {
    ...ready,
    normalMapReady: true,
    occlusionMapReady: true,
  });
  expect(legacy.u_TextureCoords).toEqual(Float32Array.of(0, 0, 1, 0));
  expect(legacy.u_NormalUvTransform).toEqual(Float32Array.of(0.25, 0.5, 1, 1));
  expect(legacy.u_OcclusionUvTransform).toEqual(Float32Array.of(0, 0, 2, 0.5));
  expect(legacy.u_NormalParams).toEqual(Float32Array.of(1, 1, 0.3, 0.5));
  expect(legacy.u_OcclusionParams).toEqual(Float32Array.of(1, 0, -0.2, 0.7));
  uniforms.update(transform, material, {
    ...ready,
    normalMapReady: true,
    occlusionMapReady: true,
  });
  expect(setSubData).toHaveBeenCalledTimes(1);
});

it('updates optional tone bands in the model uniform without changing the pose', () => {
  const { uniforms, transform, material, setSubData } = setup();
  const invert = jest.spyOn(mat4, 'invert');
  expect(
    uniforms.update(transform, material, ready).u_StylizationParams,
  ).toEqual(Float32Array.of(0, 0, 0, 0));
  material.toneSteps = 4;
  expect(
    uniforms.update(transform, material, ready).u_StylizationParams,
  ).toEqual(Float32Array.of(4, 0, 0, 0));
  material.toneSteps = 1;
  expect(
    uniforms.update(transform, material, ready).u_StylizationParams,
  ).toEqual(Float32Array.of(0, 0, 0, 0));
  expect(setSubData).toHaveBeenCalledTimes(3);
  expect(invert).toHaveBeenCalledTimes(1);
});

it('uploads outline color and CSS-pixel width without rebuilding geometry', () => {
  const { uniforms, transform, material, setSubData } = setup();
  const invert = jest.spyOn(mat4, 'invert');
  material.outlineWidth = 2;
  material.outlineColor = [0.1, 0.2, 0.3, 1];
  const legacy = uniforms.update(transform, material, ready, [1280, 800, 2]);
  expect(legacy.u_OutlineParams).toEqual(Float32Array.of(4, 1280, 800, 0));
  expect(legacy.u_OutlineColor).toEqual(Float32Array.of(0.1, 0.2, 0.3, 1));
  uniforms.update(transform, material, ready, [1280, 800, 2]);
  expect(setSubData).toHaveBeenCalledTimes(1);
  material.outlineWidth = 0;
  expect(
    uniforms.update(transform, material, ready, [1280, 800, 2]).u_OutlineParams,
  ).toEqual(Float32Array.of(0, 0, 0, 0));
  material.outlineWidth = Number.NaN;
  expect(
    uniforms.update(transform, material, ready, [1280, 800, 2]).u_OutlineParams,
  ).toEqual(Float32Array.of(0, 0, 0, 0));
  material.outlineWidth = 12;
  expect(
    uniforms.update(transform, material, ready, [1280, 800, 2]).u_OutlineParams,
  ).toEqual(Float32Array.of(16, 1280, 800, 0));
  expect(invert).toHaveBeenCalledTimes(1);
});

it('uploads optional rim light without changing the pose', () => {
  const { uniforms, transform, material, setSubData } = setup();
  const invert = jest.spyOn(mat4, 'invert');
  const initial = uniforms.update(transform, material, ready);
  expect(initial.u_StylizationParams).toEqual(Float32Array.of(0, 0, 0, 0));
  material.rimLightStrength = 0.9;
  material.rimLightColor = [0.2, 0.4, 0.8, 1];
  const lit = uniforms.update(transform, material, ready);
  expect(lit.u_StylizationParams).toEqual(Float32Array.of(0, 0.9, 0, 0));
  expect(lit.u_RimColor).toEqual(Float32Array.of(0.2, 0.4, 0.8, 1));
  material.rimLightStrength = 2;
  expect(
    uniforms.update(transform, material, ready).u_StylizationParams,
  ).toEqual(Float32Array.of(0, 1, 0, 0));
  material.rimLightStrength = Number.NaN;
  expect(
    uniforms.update(transform, material, ready).u_StylizationParams,
  ).toEqual(Float32Array.of(0, 0, 0, 0));
  expect(setSubData).toHaveBeenCalledTimes(4);
  expect(invert).toHaveBeenCalledTimes(1);
});

it('retries failed uploads without rebuilding unchanged matrices', () => {
  const { uniforms, transform, material, data, setSubData } = setup();
  const invert = jest.spyOn(mat4, 'invert');
  setSubData.mockImplementationOnce(() => {
    throw new Error('upload failed');
  });
  expect(() => uniforms.update(transform, material, ready)).toThrow(
    'upload failed',
  );
  uniforms.update(transform, material, ready);
  expect(data[0]).toBe(1);
  expect(setSubData).toHaveBeenCalledTimes(2);
  expect(invert).toHaveBeenCalledTimes(1);
});

it('keeps model contents independent for deferred submission and a replacement buffer', () => {
  const a = setup();
  const b = setup();
  a.transform.translation[0] = 11;
  b.transform.translation[0] = 22;
  a.uniforms.update(a.transform, a.material, ready);
  b.uniforms.update(b.transform, b.material, ready);
  expect(a.data[12]).toBe(11);
  expect(b.data[12]).toBe(22);
  const replacement = setup();
  replacement.uniforms.update(a.transform, a.material, ready);
  expect(replacement.setSubData).toHaveBeenCalledTimes(1);
  expect(replacement.data).toEqual(a.data);
});
