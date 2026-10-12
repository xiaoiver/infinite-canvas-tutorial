import type { Buffer } from '../../packages/device-api/src';
import type { Entity } from '../../packages/ecs/src';
import { Camera, Camera3D, Light3D } from '../../packages/ecs/src/components';
import { Mat3 } from '../../packages/ecs/src/components/math/Mat3';
import { Mat4 } from '../../packages/ecs/src/components/math/Mat4';
import { MeshSceneUniforms } from '../../packages/ecs/src/systems/mesh3d/mesh-scene-uniforms';
import {
  buildCamera3DSceneUniforms,
  packSceneUniformBuffer,
} from '../../packages/ecs/src/utils/mesh3d-scene';

function setup() {
  const bytes = new Uint8Array(188 * 4);
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
      ) =>
        uniforms.update(
          camera,
          aspect,
          cam2d,
          lights.map((light) => ({ read: () => light } as unknown as Entity)),
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
  expect(legacy.u_LightParams3D).toEqual(data.slice(156));
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
  expect([...data.slice(48, 52)]).toEqual([0, 0, 0, 0]);
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
  expect([...data.slice(52, 56)]).toEqual(
    [0.23, 0.26, 0.29, 1].map(Math.fround),
  );
  expect(data[56]).toBe(2); // spot + directional fill
  expect([...data.slice(60, 64)]).toEqual([2, 3, 4, 0]);
  expect([...data.slice(92, 96)]).toEqual([0, -1, 0, 1]);
  expect([...data.slice(124, 128)]).toEqual([1, 0.5, 0.25, 0]);
  expect([...data.slice(156, 164)]).toEqual([3, 2, 40, 1, 1, 0.75, 0, 0]);
  spot.innerConeAngle = 0.5;
  spot.outerConeAngle = 0.25;
  spot.color[0] = 0.2;
  spot.position[0] = 5;
  spot.direction[0] = 0.4;
  spot.intensity = 3;
  spot.range = 20;
  uniforms.update(camera, 2, undefined, lights);
  expect(data[95]).toBeCloseTo(Math.cos(0.5));
  expect(data[159]).toBeCloseTo(Math.cos(0.5));
  expect(data[60]).toBe(5);
  expect(data[92]).toBeCloseTo(0.4);
  expect(data[124]).toBeCloseTo(0.2);
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
