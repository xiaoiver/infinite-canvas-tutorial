import type { Buffer } from '../../packages/device-api/src';
import type { Entity } from '../../packages/ecs/src';
import { Camera, Camera3D, Light3D } from '../../packages/ecs/src/components';
import { Mat3 } from '../../packages/ecs/src/components/math/Mat3';
import { Mat4 } from '../../packages/ecs/src/components/math/Mat4';
import {
  MeshSceneUniforms,
  MESH_SCENE_UNIFORM_FLOATS,
} from '../../packages/ecs/src/systems/mesh3d/mesh-scene-uniforms';
import {
  buildCamera3DSceneUniforms,
  packSceneUniformBuffer,
} from '../../packages/ecs/src/utils/mesh3d-scene';

function setup() {
  const bytes = new Uint8Array(MESH_SCENE_UNIFORM_FLOATS * 4);
  const upload = jest.fn((offset: number, value: Uint8Array) =>
    bytes.set(value, offset),
  );
  const uniforms = new MeshSceneUniforms({
    setSubData: upload,
  } as unknown as Buffer);
  const camera = new Camera3D();
  return {
    uniforms: {
      update: (
        camera: Camera3D,
        aspect: number,
        cam2d: Entity | undefined,
        lights: Light3D[],
        shadows?: {
          viewProjection: Float32Array;
          lightIndex: number;
          texelSize: number;
          faces?: Float32Array[];
          strength?: number;
          softness?: number;
        }[],
      ) =>
        uniforms.update(
          camera,
          aspect,
          cam2d,
          lights.map((light) => ({ read: () => light } as unknown as Entity)),
          shadows,
        ),
    },
    camera,
    upload,
    data: new Float32Array(bytes.buffer),
  };
}
function linkedCamera() {
  const canvas = { width: 400, height: 200 };
  const computed = {
    x: 0,
    y: 0,
    zoom: 1,
    viewMatrix: Mat3.copy(Mat3.IDENTITY),
    viewProjectionMatrix: Mat3.copy(Mat3.IDENTITY),
  };
  const camera = { canvas: { read: () => canvas } as unknown as Entity | null };
  const entity = {
    read: (type: unknown) => (type === Camera ? camera : computed),
  } as unknown as Entity;
  return { entity, camera, computed, canvas };
}
afterEach(() => jest.restoreAllMocks());

it('keeps camera matrices, typed views and uploads stable for equivalent inputs', () => {
  const { uniforms, camera, upload, data } = setup();
  const projection = jest.spyOn(Mat4, 'perspective');
  const legacy = uniforms.update(camera, 2, undefined, []);
  expect(data[0]).toBeCloseTo(data[5] / 2);
  expect(data[30]).toBe(-5);
  expect([...data.slice(52, 60)]).toEqual([1, 1, 1, 1, 1, 0, 0, 0]);
  for (let i = 0; i < 5; i++)
    expect(uniforms.update(new Camera3D(), 2, undefined, [])).toBe(legacy);
  expect(upload).toHaveBeenCalledTimes(1);
  expect(projection).toHaveBeenCalledTimes(1);
  expect(legacy.u_LightParams3D).toEqual(data.slice(156, 188));
});

it('uploads two shadow matrices and clears them when disabled', () => {
  const { uniforms, camera, data, upload } = setup();
  const light = new Light3D({ type: 'directional' });
  const matrix = new Float32Array(16);
  matrix[0] = 2;
  matrix[5] = 3;
  matrix[10] = 4;
  matrix[15] = 1;
  const second = new Float32Array(16);
  second[0] = 9;
  uniforms.update(
    camera,
    1,
    undefined,
    [light],
    [
      {
        viewProjection: matrix,
        lightIndex: 1,
        texelSize: 1 / 1024,
      },
      {
        viewProjection: second,
        lightIndex: 0,
        texelSize: 1 / 512,
      },
    ],
  );
  expect([...data.slice(188, 204)]).toEqual([...matrix]);
  expect([...data.slice(204, 220)]).toEqual([...second]);
  expect([...data.slice(220, 228)]).toEqual([
    2,
    1 / 1024,
    0,
    0,
    1,
    1 / 512,
    0,
    0,
  ]);
  expect([...data.slice(420, 428)]).toEqual([1, 1, 1, 0, 1, 1, 1, 0]);
  const calls = upload.mock.calls.length;
  light.intensity = 2;
  uniforms.update(
    camera,
    1,
    undefined,
    [light],
    [
      {
        viewProjection: matrix,
        lightIndex: 1,
        texelSize: 1 / 1024,
      },
      {
        viewProjection: second,
        lightIndex: 0,
        texelSize: 1 / 512,
      },
    ],
  );
  expect(upload).toHaveBeenCalledTimes(calls + 1);
  expect([...data.slice(188, 204)]).toEqual([...matrix]);
  uniforms.update(
    camera,
    1,
    undefined,
    [light],
    [
      {
        viewProjection: matrix,
        lightIndex: 1,
        texelSize: 1 / 1024,
      },
      {
        viewProjection: second,
        lightIndex: 0,
        texelSize: 1 / 512,
      },
    ],
  );
  expect(upload).toHaveBeenCalledTimes(calls + 1);
  uniforms.update(camera, 1, undefined, []);
  expect([...data.slice(188, 228)]).toEqual(Array(40).fill(0));
  expect([...data.slice(420, 428)]).toEqual(Array(8).fill(0));
});

it('uploads shadow strength, softness and bias without changing matrices', () => {
  const { uniforms, camera, data, upload } = setup();
  const matrix = new Float32Array(16);
  const shadow = { viewProjection: matrix, lightIndex: 0, texelSize: 1 / 1024 };
  uniforms.update(camera, 1, undefined, [], [shadow]);
  expect([...data.slice(420, 428)]).toEqual([1, 1, 1, 0, 0, 0, 0, 0]);
  const calls = upload.mock.calls.length;
  uniforms.update(
    camera,
    1,
    undefined,
    [],
    [{ ...shadow, strength: 0.5, softness: 2, biasScale: 0.5, normalBias: 2 }],
  );
  expect(upload).toHaveBeenCalledTimes(calls + 1);
  expect([...data.slice(420, 424)]).toEqual([0.5, 2, 0.5, 2]);
  expect([...data.slice(188, 204)]).toEqual([...matrix]);
  uniforms.update(
    camera,
    1,
    undefined,
    [],
    [{ ...shadow, strength: -1, softness: 9, biasScale: -1, normalBias: 20 }],
  );
  expect([...data.slice(420, 424)]).toEqual([0, 4, 0, 10]);
  uniforms.update(
    camera,
    1,
    undefined,
    [],
    [{ ...shadow, biasScale: NaN, normalBias: Infinity }],
  );
  expect([...data.slice(420, 424)]).toEqual([1, 1, 1, 0]);
});

it('uploads all six point shadow matrices and clears the atlas mode', () => {
  const { uniforms, camera, data } = setup();
  const faces = Array.from({ length: 6 }, (_, index) => {
    const face = new Float32Array(16);
    face[0] = index + 1;
    return face;
  });
  uniforms.update(
    camera,
    1,
    undefined,
    [new Light3D({ type: 'point' })],
    [
      {
        viewProjection: faces[0],
        lightIndex: 0,
        texelSize: 1 / 512,
        faces,
      },
    ],
  );
  expect([...data.slice(220, 224)]).toEqual([1, 1 / 512, 1, 0]);
  faces.forEach((face, index) =>
    expect([...data.slice(228 + index * 16, 244 + index * 16)]).toEqual([
      ...face,
    ]),
  );
  uniforms.update(camera, 1, undefined, []);
  expect([...data.slice(220, MESH_SCENE_UNIFORM_FLOATS)]).toEqual(
    Array(MESH_SCENE_UNIFORM_FLOATS - 220).fill(0),
  );
});

it('clears the second light and its point faces when that caster is disabled', () => {
  const { uniforms, camera, data } = setup();
  const first = new Float32Array(16);
  const faces = Array.from({ length: 6 }, (_, index) => {
    const face = new Float32Array(16);
    face[0] = index + 1;
    return face;
  });
  const lights = [
    new Light3D({ type: 'directional' }),
    new Light3D({ type: 'point' }),
  ];
  const directional = {
    viewProjection: first,
    lightIndex: 0,
    texelSize: 1 / 1024,
  };
  uniforms.update(camera, 1, undefined, lights, [
    directional,
    {
      viewProjection: faces[0],
      lightIndex: 1,
      texelSize: 1 / 512,
      faces,
    },
  ]);
  expect([...data.slice(224, 228)]).toEqual([2, 1 / 512, 1, 0]);
  expect([...data.slice(324, 340)]).toEqual([...faces[0]]);
  uniforms.update(camera, 1, undefined, lights, [directional]);
  expect([...data.slice(224, 228)]).toEqual([0, 0, 0, 0]);
  expect([...data.slice(324, 420)]).toEqual(Array(96).fill(0));
  expect([...data.slice(420, 428)]).toEqual([1, 1, 1, 0, 0, 0, 0, 0]);
});

it.each([
  'eye',
  'center',
  'up',
  'near',
  'far',
  'fovy',
  'aspect',
  'orthographic',
] as const)(
  'refreshes standard camera %s without retaining mutable component arrays',
  (input) => {
    const { uniforms, camera, upload, data } = setup();
    uniforms.update(camera, 2, undefined, []);
    let aspect = 2;
    if (input === 'aspect') aspect = 3;
    else if (input === 'orthographic') camera.projection = 'orthographic';
    else if (input === 'eye' || input === 'center' || input === 'up')
      camera[input][0] = 0.5;
    else camera[input] *= 0.5;
    uniforms.update(camera, aspect, undefined, []);
    expect(upload).toHaveBeenCalledTimes(2);
    expect(data.slice(0, 52)).toEqual(
      packSceneUniformBuffer(buildCamera3DSceneUniforms(camera, aspect)),
    );
    uniforms.update(camera, aspect, undefined, []);
    expect(upload).toHaveBeenCalledTimes(2);
  },
);

it.each([
  'vp',
  'view',
  'x',
  'y',
  'zoom',
  'height',
  'missing canvas',
  'missing camera',
  'unlinked',
  'projection',
])('invalidates linked perspective after %s changes', (input) => {
  const { uniforms, camera, upload, data } = setup();
  const linked = linkedCamera();
  camera.linked = true;
  camera.projection = 'perspective';
  let entity: Entity | undefined = linked.entity;
  uniforms.update(camera, 2, entity, []);
  expect(data[51]).toBeLessThan(0);
  if (input === 'vp') linked.computed.viewProjectionMatrix.m20 = 0.5;
  else if (input === 'view') linked.computed.viewMatrix.m20 = 2;
  else if (input === 'x' || input === 'y' || input === 'zoom')
    linked.computed[input] += 2;
  else if (input === 'height') linked.canvas.height = 300;
  else if (input === 'missing canvas') linked.camera.canvas = null;
  else if (input === 'missing camera') entity = undefined;
  else if (input === 'unlinked') camera.linked = false;
  else camera.projection = 'orthographic';
  uniforms.update(camera, 2, entity, []);
  expect(upload).toHaveBeenCalledTimes(2);
  expect(data.slice(0, 52)).toEqual(
    packSceneUniformBuffer(buildCamera3DSceneUniforms(camera, 2, entity)),
  );
  uniforms.update(camera, 2, entity, []);
  expect(upload).toHaveBeenCalledTimes(2);
});

it('updates linked orthographic VP and depth, ignoring perspective-only parameters', () => {
  const { uniforms, camera, upload, data } = setup();
  const { entity, computed } = linkedCamera();
  camera.linked = true;
  camera.projection = 'orthographic';
  uniforms.update(camera, 2, entity, []);
  expect(data[10]).toBeCloseTo(-2 / camera.far);
  camera.fovy *= 0.5;
  uniforms.update(camera, 3, entity, []);
  expect(upload).toHaveBeenCalledTimes(1);
  computed.viewProjectionMatrix.m20 = 0.25;
  camera.far = 0;
  uniforms.update(camera, 3, entity, []);
  expect(data[12]).toBe(0.25);
  expect(data[10]).toBe(0);
  expect([...data.slice(48, 52)]).toEqual([0, 0, -1, -1]);
});

it('packs the actual eye for perspective and a constant direction for orthographic lighting', () => {
  const { uniforms, camera, data } = setup();
  camera.eye = [30, 20, 80];
  camera.center = [10, 5, 0];
  uniforms.update(camera, 2, undefined, []);
  expect([...data.slice(48, 52)]).toEqual([30, 20, 0, 80]);
  camera.projection = 'orthographic';
  uniforms.update(camera, 2, undefined, []);
  expect([...data.slice(48, 52)]).toEqual([20, 15, -1, 80]);
});

it('packs custom lights, clamps spot cones and clears removed slots without rebuilding matrices', () => {
  const { uniforms, camera, upload, data } = setup();
  const projection = jest.spyOn(Mat4, 'perspective');
  const ambient = new Light3D({
    type: 'ambient',
    color: [0.1, 0.2, 0.3],
    intensity: 0.3,
  });
  const spot = new Light3D({
    type: 'spot',
    position: [2, 3, 4],
    direction: [0, -1, 0],
    color: [1, 0.5, 0.25],
    intensity: 2,
    range: 40,
    innerConeAngle: -1,
    outerConeAngle: -2,
  });
  const lights = [
    ambient,
    new Light3D({ type: 'ambient', intensity: 0.2 }),
    spot,
  ];
  const legacy = uniforms.update(camera, 2, undefined, lights);
  const linear = (color: number) =>
    color <= 0.04045 ? color / 12.92 : ((color + 0.055) / 1.055) ** 2.4;
  expect(data[52]).toBeCloseTo(linear(0.1) * 0.3 + 0.2);
  expect(data[53]).toBeCloseTo(linear(0.2) * 0.3 + 0.2);
  expect(data[54]).toBeCloseTo(linear(0.3) * 0.3 + 0.2);
  expect(data[56]).toBe(1); // explicit spot, with no injected directional light
  expect([...data.slice(60, 64)]).toEqual([2, 3, 4, 0]);
  expect(data[92]).toBe(0);
  expect(data[93]).toBe(-1);
  expect(data[95]).toBeCloseTo(Math.cos(0.01), 6);
  expect(data[159] - data[95]).toBeGreaterThan(1e-5);
  expect(data[124]).toBe(1);
  expect(data[125]).toBeCloseTo(linear(0.5));
  expect(data[126]).toBeCloseTo(linear(0.25));
  expect([...data.slice(156, 159)]).toEqual([3, 2, 40]);
  expect(data[159]).toBe(1);
  spot.innerConeAngle = 0.5;
  spot.outerConeAngle = 0.25;
  spot.color[0] = 0.2;
  spot.position[0] = 5;
  spot.direction[0] = 0.4;
  spot.intensity = 3;
  spot.range = 20;
  uniforms.update(camera, 2, undefined, lights);
  expect(data[95]).toBeCloseTo(Math.cos(0.51), 6);
  expect(data[159]).toBeCloseTo(Math.cos(0.5));
  expect(data[60]).toBe(5);
  expect(data[92]).toBeCloseTo(0.4);
  expect(data[124]).toBeCloseTo(linear(0.2));
  expect([...data.slice(156, 159)]).toEqual([3, 3, 20]);
  expect(legacy.u_LightPositions).toEqual(data.slice(60, 92));
  uniforms.update(camera, 2, undefined, lights);
  expect(upload).toHaveBeenCalledTimes(2);
  uniforms.update(camera, 2, undefined, [new Light3D({ type: 'directional' })]);
  expect(data[56]).toBe(1);
  for (const start of [60, 92, 124, 156])
    expect([...data.slice(start + 4, start + 32)]).toEqual(Array(28).fill(0));
  expect(data[95]).toBe(0);
  expect(data[159]).toBe(0);
  uniforms.update(camera, 2, undefined, []);
  expect([...data.slice(52, 56)]).toEqual([1, 1, 1, 1]);
  expect(projection).toHaveBeenCalledTimes(1);
});

it('sanitizes invalid light values before uploading them to the shader', () => {
  const { uniforms, camera, data } = setup();
  const light = new Light3D({
    type: 'spot',
    color: [NaN, 2, -1],
    intensity: -4,
    position: [NaN, 2, Infinity],
    direction: [0, 0, 0],
    range: Infinity,
    innerConeAngle: NaN,
    outerConeAngle: NaN,
  });
  uniforms.update(camera, 1, undefined, [light]);
  expect([...data.slice(60, 63)]).toEqual([0, 2, 0]);
  expect([...data.slice(92, 95)]).toEqual([-0.5, -0.7, -0.5].map(Math.fround));
  expect([...data.slice(124, 127)]).toEqual([0, 1, 0]);
  expect([...data.slice(156, 159)]).toEqual([3, 0, 0]);
  expect(data[95]).toBeCloseTo(Math.cos(Math.PI / 4));
  expect(data[159]).toBeCloseTo(Math.cos(Math.PI / 8));
  light.intensity = NaN;
  uniforms.update(camera, 1, undefined, [light]);
  expect(data[157]).toBe(0);
});

it('packs inverse-square reference distance and invalidates cached light uniforms', () => {
  const { uniforms, camera, data, upload } = setup();
  const point = new Light3D({ type: 'point', range: 500 });
  uniforms.update(camera, 1, undefined, [point]);
  expect(data[63]).toBe(0);
  point.attenuation = 'inverse-square';
  point.referenceDistance = 80;
  uniforms.update(camera, 1, undefined, [point]);
  expect(data[63]).toBe(80);
  expect(upload).toHaveBeenCalledTimes(2);
  uniforms.update(camera, 1, undefined, [point]);
  expect(upload).toHaveBeenCalledTimes(2);
  point.referenceDistance = NaN;
  uniforms.update(camera, 1, undefined, [point]);
  expect(data[63]).toBe(100);
  point.attenuation = 'range';
  uniforms.update(camera, 1, undefined, [point]);
  expect(data[63]).toBe(0);
});

it('caps punctual lights at eight while accumulating all ambient lights', () => {
  const { uniforms, camera, data } = setup();
  const lights = Array.from(
    { length: 9 },
    (_, i) => new Light3D({ type: 'point', position: [i, 0, 0] }),
  );
  lights.push(new Light3D({ type: 'ambient', intensity: 0.2 }));
  uniforms.update(camera, 1, undefined, lights);
  expect(data[56]).toBe(8);
  expect(data[88]).toBe(7);
  expect(data[184]).toBe(2);
  expect(data[52]).toBeCloseTo(0.2);
  lights.reverse();
  uniforms.update(camera, 1, undefined, lights);
  expect(data[60]).toBe(8);
  expect(data[88]).toBe(1);
});

it('retries uploads and keeps replacement/cross-canvas scene buffers independent', () => {
  const a = setup();
  const b = setup();
  const projection = jest.spyOn(Mat4, 'perspective');
  a.upload.mockImplementationOnce(() => {
    throw new Error('upload');
  });
  expect(() => a.uniforms.update(a.camera, 2, undefined, [])).toThrow('upload');
  a.uniforms.update(a.camera, 2, undefined, []);
  expect(a.upload).toHaveBeenCalledTimes(2);
  expect(projection).toHaveBeenCalledTimes(1);
  b.camera.eye[2] = 10;
  b.uniforms.update(b.camera, 1, undefined, []);
  expect(a.data[30]).toBe(-5);
  expect(b.data[30]).toBe(-10);
  const replacement = setup();
  replacement.uniforms.update(a.camera, 2, undefined, []);
  expect(replacement.data).toEqual(a.data);
  expect(replacement.upload).toHaveBeenCalledTimes(1);
});
