import { vec3 } from 'gl-matrix';
import { fitDirectionalShadow, fitSpotShadow } from '../../packages/ecs/src/systems/mesh3d/shadow-projection';

const identity = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
]);

it('fits all caster corners inside directional shadow clip space', () => {
  const floor = {
    min: [-100, -80, 100] as [number, number, number],
    max: [100, 80, 100] as [number, number, number],
    model: identity,
  };
  const raised = {
    min: [-10, -10, -10] as [number, number, number],
    max: [10, 10, 10] as [number, number, number],
    model: new Float32Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 30, 20, 0, 1,
    ]),
  };
  const vp = fitDirectionalShadow([0.45, 0.65, 0.55], [floor, raised]);
  expect(vp).not.toBeNull();
  for (const bounds of [floor, raised]) {
    for (const x of [bounds.min[0], bounds.max[0]])
      for (const y of [bounds.min[1], bounds.max[1]])
        for (const z of [bounds.min[2], bounds.max[2]]) {
          const world = vec3.transformMat4(
            vec3.create(), vec3.fromValues(x, y, z), bounds.model,
          );
          const clip = vec3.transformMat4(vec3.create(), world, vp!);
          expect(Math.max(...clip.map(Math.abs))).toBeLessThanOrEqual(1);
        }
  }
});

it('skips degenerate shadows', () => {
  expect(fitDirectionalShadow([1, 0, 0], [])).toBeNull();
  expect(fitDirectionalShadow([0, 0, 0], [{ min: [0, 0, 0], max: [1, 1, 1], model: identity }])).toBeNull();
});

it('fits a spotlight perspective frustum to receiver and caster depth', () => {
  const floor = {
    min: [-100, -80, 100] as [number, number, number],
    max: [100, 80, 100] as [number, number, number],
    model: identity,
  };
  const raised = {
    min: [-10, -10, -10] as [number, number, number],
    max: [10, 10, 10] as [number, number, number],
    model: identity,
  };
  const vp = fitSpotShadow([0, 0, -100], [0, 0, 1], Math.PI / 4, 500, [floor, raised]);
  expect(vp).not.toBeNull();
  for (const bounds of [floor, raised])
    for (const x of [bounds.min[0], bounds.max[0]])
      for (const y of [bounds.min[1], bounds.max[1]])
        for (const z of [bounds.min[2], bounds.max[2]]) {
          const clip = vec3.transformMat4(vec3.create(), vec3.fromValues(x, y, z), vp!);
          expect(Math.max(...clip.map(Math.abs))).toBeLessThanOrEqual(1);
        }
  expect(fitSpotShadow([0, 0, -100], [0, 0, 1], Math.PI / 2, 500, [floor])).toBeNull();
});
