import { vec3 } from 'gl-matrix';
import {
  fitDirectionalShadow,
  fitPointShadow,
  fitSpotShadow,
} from '../../packages/ecs/src/systems/mesh3d/shadow-projection';

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
    model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 30, 20, 0, 1]),
  };
  const vp = fitDirectionalShadow([0.45, 0.65, 0.55], [floor, raised]);
  expect(vp).not.toBeNull();
  for (const bounds of [floor, raised]) {
    for (const x of [bounds.min[0], bounds.max[0]])
      for (const y of [bounds.min[1], bounds.max[1]])
        for (const z of [bounds.min[2], bounds.max[2]]) {
          const world = vec3.transformMat4(
            vec3.create(),
            vec3.fromValues(x, y, z),
            bounds.model,
          );
          const clip = vec3.transformMat4(vec3.create(), world, vp!);
          expect(Math.max(...clip.map(Math.abs))).toBeLessThanOrEqual(1);
        }
  }
});

it('skips degenerate shadows', () => {
  expect(fitDirectionalShadow([1, 0, 0], [])).toBeNull();
  expect(
    fitDirectionalShadow(
      [0, 0, 0],
      [{ min: [0, 0, 0], max: [1, 1, 1], model: identity }],
    ),
  ).toBeNull();
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
  const vp = fitSpotShadow([0, 0, -100], [0, 0, 1], Math.PI / 4, 500, [
    floor,
    raised,
  ]);
  expect(vp).not.toBeNull();
  for (const bounds of [floor, raised])
    for (const x of [bounds.min[0], bounds.max[0]])
      for (const y of [bounds.min[1], bounds.max[1]])
        for (const z of [bounds.min[2], bounds.max[2]]) {
          const clip = vec3.transformMat4(
            vec3.create(),
            vec3.fromValues(x, y, z),
            vp!,
          );
          expect(Math.max(...clip.map(Math.abs))).toBeLessThanOrEqual(1);
        }
  expect(
    fitSpotShadow([0, 0, -100], [0, 0, 1], Math.PI / 2, 500, [floor]),
  ).toBeNull();
});

it('covers six directions from a point light and rejects unusable inputs', () => {
  const bounds = {
    min: [-10, -10, -10] as [number, number, number],
    max: [10, 10, 10] as [number, number, number],
    model: identity,
  };
  const faces = fitPointShadow([0, 0, 0], 50, [bounds]);
  expect(faces).toHaveLength(6);
  const directions: [number, number, number][] = [
    [5, 0, 0],
    [-5, 0, 0],
    [0, 5, 0],
    [0, -5, 0],
    [0, 0, 5],
    [0, 0, -5],
  ];
  directions.forEach((direction, index) => {
    const clip = vec3.transformMat4(vec3.create(), direction, faces![index]);
    expect(Math.max(...clip.map(Math.abs))).toBeLessThan(1);
    expect(Math.abs(clip[0])).toBeLessThan(1e-5);
    expect(Math.abs(clip[1])).toBeLessThan(1e-5);
  });
  expect(fitPointShadow([0, 0, 0], 50, [])).toBeNull();
  expect(fitPointShadow([NaN, 0, 0], 50, [bounds])).toBeNull();
});
