import { mat4 } from 'gl-matrix';
import type { Buffer } from '../../packages/device-api/src';
import { Material3D } from '../../packages/ecs/src/components/geometry3d/Material3D';
import { Transform3D } from '../../packages/ecs/src/components/geometry3d/Transform3D';
import {
  MESH_MODEL_UNIFORM_FLOATS,
  MeshModelUniforms,
} from '../../packages/ecs/src/systems/mesh3d/mesh-model-uniforms';

const ready = {
  mapReady: false,
  specularMapReady: false,
  bumpMapReady: false,
  environmentMapReady: false,
  environmentIrradiance: null,
};
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
  expect(legacy.u_MaterialFlags).toEqual(data.slice(48, 52));
  uniforms.update(transform, material, textures);
  expect(setSubData).toHaveBeenCalledTimes(2);
  uniforms.update(transform, material, ready);
  expect([...data.slice(48, 51)]).toEqual([0, 0, 0]);
  expect(data[55]).toBe(0);
  expect(data[60]).toBe(0);
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
  const receiveOffset = MESH_MODEL_UNIFORM_FLOATS - 4;
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
  const offset = MESH_MODEL_UNIFORM_FLOATS - 4;
  material.alphaMode = 'mask';
  material.alphaCutoff = 0.35;
  material.baseColor = [1, 1, 1, 0.8];
  uniforms.updateShadowMaterial(transform, material, true);
  expect(data[35]).toBeCloseTo(0.8);
  expect(data[48]).toBe(1);
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
