import {
  Camera3D,
  axonometricCameraPose,
} from '../../packages/ecs/src/components';
import { buildCamera3DSceneUniforms } from '../../packages/ecs/src/utils/mesh3d-scene';
import { resolveMesh3DCameraConfig } from '../../packages/ecs/src/utils/mesh3d-companion';
import { Mat4 } from '../../packages/ecs/src/components/math/Mat4';
import { findCamera3DForCanvas } from '../../packages/ecs/src/utils/canvas3d-scope';
import type { Entity } from '../../packages/ecs/src';

function project(matrix: Mat4, point: [number, number, number]) {
  const m = matrix.toFloat32Array();
  return [
    m[0] * point[0] + m[4] * point[1] + m[8] * point[2] + m[12],
    m[1] * point[0] + m[5] * point[1] + m[9] * point[2] + m[13],
  ];
}

function projectDepth(matrix: Mat4, point: [number, number, number]) {
  const m = matrix.toFloat32Array();
  return (m[2] * point[0] + m[6] * point[1] + m[10] * point[2] + m[14] + 1) / 2;
}

it('uses equal projected lengths for all three world axes in the isometric preset', () => {
  const camera = new Camera3D({
    ...resolveMesh3DCameraConfig({
      preset: 'isometric',
      center: [120, 80, 0],
      distance: 500,
      orthographicHeight: 400,
    }),
  });
  const uniforms = buildCamera3DSceneUniforms(camera, 2);
  const vp = Mat4.multiply(uniforms.projMatrix, uniforms.viewMatrix);
  const origin = project(vp, [120, 80, 0]);
  const lengths = ([1, 0, 0] as const).map((_, axis) => {
    const point: [number, number, number] = [120, 80, 0];
    point[axis] += 1;
    const projected = project(vp, point);
    return Math.hypot(2 * (projected[0] - origin[0]), projected[1] - origin[1]);
  });
  expect(lengths[0]).toBeCloseTo(lengths[1], 5);
  expect(lengths[1]).toBeCloseTo(lengths[2], 5);
  expect(camera.linked).toBe(false);
  expect(camera.projection).toBe('orthographic');
  expect(
    resolveMesh3DCameraConfig({ preset: 'isometric' }).orthographicHeight,
  ).toBe(500);
  expect(
    resolveMesh3DCameraConfig({
      preset: 'isometric',
      linked: true,
      projection: 'perspective',
    }),
  ).toMatchObject({
    linked: false,
    projection: 'orthographic',
  });
});

it('keeps orthographic size stable when distance or preset changes', () => {
  const projection = (
    preset: 'isometric' | 'dimetric-2-1',
    distance: number,
  ) => {
    const camera = new Camera3D({
      ...resolveMesh3DCameraConfig({
        preset,
        distance,
        orthographicHeight: 400,
      }),
    });
    return buildCamera3DSceneUniforms(camera, 2).projMatrix.toFloat32Array();
  };
  expect(projection('isometric', 200)).toEqual(projection('isometric', 800));
  expect(projection('isometric', 200)).toEqual(projection('dimetric-2-1', 800));
  expect(
    axonometricCameraPose('dimetric-2-1', [0, 0, 0], 100).eye[2],
  ).toBeCloseTo(50);
});

it('places nearer meshes above the ground in the shared GREATER depth pass', () => {
  const camera = new Camera3D({
    ...resolveMesh3DCameraConfig({
      preset: 'isometric',
      distance: 650,
      orthographicHeight: 380,
    }),
  });
  const { projMatrix, viewMatrix } = buildCamera3DSceneUniforms(camera, 1);
  const vp = Mat4.multiply(projMatrix, viewMatrix);
  const ground = projectDepth(vp, [0, 0, -50]);
  const cube = projectDepth(vp, [0, 0, 50]);
  expect(cube).toBeGreaterThan(ground);
  expect(ground).toBeGreaterThan(0.5);
});

it('preserves legacy linked defaults and distance-based free orthographic sizing', () => {
  expect(resolveMesh3DCameraConfig({})).toMatchObject({
    linked: true,
    projection: 'perspective',
    orthographicHeight: 0,
  });
  const camera = new Camera3D({ projection: 'orthographic', eye: [0, 0, 8] });
  const oldProjection = buildCamera3DSceneUniforms(
    camera,
    1,
  ).projMatrix.toFloat32Array();
  camera.orthographicHeight = 16;
  const newProjection = buildCamera3DSceneUniforms(
    camera,
    1,
  ).projMatrix.toFloat32Array();
  expect(newProjection[0]).toBe(oldProjection[0]);
  expect(newProjection[5]).toBe(oldProjection[5]);
  expect(newProjection[10]).toBeCloseTo(-oldProjection[10] / 4);
});

it('keeps an explicit 3D camera local to its canvas', () => {
  const canvasA = { has: (type: unknown) => type === Camera3D } as Entity;
  const canvasB = { has: () => false } as unknown as Entity;
  expect(findCamera3DForCanvas([], canvasA, 2)).toBe(canvasA);
  expect(findCamera3DForCanvas([], canvasB, 2)).toBeUndefined();
});
