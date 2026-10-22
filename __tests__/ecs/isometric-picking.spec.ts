import { mat4 } from 'gl-matrix';
import { Camera3D } from '../../packages/ecs/src/components';
import {
  buildCamera3DSceneUniforms,
  sceneUniformsToPickScene,
} from '../../packages/ecs/src/utils/mesh3d-scene';
import { resolveMesh3DCameraConfig } from '../../packages/ecs/src/utils/mesh3d-companion';
import { pickMeshAtViewport } from '../../packages/ecs/src/utils/ray-casting';

const plane = new Float32Array([
  -1000, -1000, 0, 1000, -1000, 0, 1000, 1000, 0, -1000, -1000, 0, 1000, 1000,
  0, -1000, 1000, 0,
]);

it('picks the visible upper surface before the ground in a reversed-depth isometric view', () => {
  const camera = new Camera3D(
    resolveMesh3DCameraConfig({
      preset: 'isometric',
      center: [0, 0, 0],
      distance: 500,
      orthographicHeight: 200,
    }),
  );
  const scene = sceneUniformsToPickScene(buildCamera3DSceneUniforms(camera, 1));
  expect(scene.mode).toBe('standard');
  if (scene.mode !== 'standard') return;
  expect(scene.reverseDepth).toBe(true);
  const hit = (z: number) =>
    pickMeshAtViewport(
      100,
      100,
      200,
      200,
      plane,
      null,
      mat4.fromTranslation(mat4.create(), [0, 0, z]),
      [0, 0, z],
      scene,
    );
  const ground = hit(0);
  const upper = hit(50);
  expect(ground).not.toBeNull();
  expect(upper).not.toBeNull();
  expect(upper!.t).toBeLessThan(ground!.t);
});
