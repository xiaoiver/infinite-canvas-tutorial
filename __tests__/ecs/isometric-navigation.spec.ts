import { Camera3D } from '../../packages/ecs/src/components';
import { resolveMesh3DCameraConfig } from '../../packages/ecs/src/utils/mesh3d-companion';
import {
  camera3DPlanePoint,
  isNavigableCamera3D,
  orbitCamera3D,
  panCamera3D,
  zoomCamera3D,
} from '../../packages/ecs/src/utils/isometric-navigation';

function createCamera() {
  return new Camera3D(
    resolveMesh3DCameraConfig({
      preset: 'isometric',
      center: [245, 180, 15],
      distance: 650,
      orthographicHeight: 380,
    }),
  );
}

function expectSamePoint(a: number[] | null, b: number[] | null) {
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  for (let axis = 0; axis < 3; axis++) {
    expect(a![axis]).toBeCloseTo(b![axis], 3);
  }
}

it('pans the ground point with the pointer without moving the 2D camera', () => {
  const camera = createCamera();
  const before = camera3DPlanePoint(camera, [320, 170], 800, 400);
  const previousZ = camera.center[2];
  expect(panCamera3D(camera, [320, 170], [355, 205], 800, 400)).toBe(true);
  expectSamePoint(before, camera3DPlanePoint(camera, [355, 205], 800, 400));
  expect(camera.center[2]).toBe(previousZ);
  expect(camera3DPlanePoint(camera, [0, 0], 0, 400)).toBeNull();
});

it('keeps the ground under the cursor during zoom and across viewport sizes', () => {
  const camera = createCamera();
  const pointer: [number, number] = [580, 90];
  const before = camera3DPlanePoint(camera, pointer, 800, 400);
  expect(zoomCamera3D(camera, pointer, -100, 800, 400, 0.003)).toBe(true);
  expect(camera.orthographicHeight).toBeLessThan(380);
  expectSamePoint(before, camera3DPlanePoint(camera, pointer, 800, 400));
  const resized = camera3DPlanePoint(camera, [290, 45], 400, 200);
  expectSamePoint(before, resized);
});

it('orbits at fixed distance and clamps elevation away from the horizon', () => {
  const camera = createCamera();
  const distance = Math.hypot(
    ...camera.eye.map((v, i) => v - camera.center[i]),
  );
  orbitCamera3D(camera, 80, -10000);
  expect(
    Math.hypot(...camera.eye.map((v, i) => v - camera.center[i])),
  ).toBeCloseTo(distance);
  expect(camera.eye[2]).toBeGreaterThan(camera.center[2]);
  expect(camera3DPlanePoint(camera, [400, 200], 800, 400)).not.toBeNull();
});

it('only enables navigation for a free orthographic camera with explicit height', () => {
  expect(isNavigableCamera3D(createCamera())).toBe(true);
  expect(
    isNavigableCamera3D(
      new Camera3D({ linked: true, orthographicHeight: 380 }),
    ),
  ).toBe(false);
  expect(
    isNavigableCamera3D(
      new Camera3D({ projection: 'perspective', orthographicHeight: 380 }),
    ),
  ).toBe(false);
  expect(
    isNavigableCamera3D(new Camera3D({ projection: 'orthographic' })),
  ).toBe(false);
});
