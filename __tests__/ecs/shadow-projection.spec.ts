import { vec3 } from 'gl-matrix';
import {
  fitDirectionalShadow,
  fitPointShadow,
  fitSpotShadow,
  intersectsShadowFrustum,
  meshWorldCorners,
  SHADOW_MAP_SIZE,
} from '../../packages/ecs/src/systems/mesh3d/shadow-projection';
import { POINT_SHADOW_FACES } from '../../packages/ecs/src/utils/geometry3d/point-shadow-faces';

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

it.each([{ direction: [0, 0, 1] }, { direction: [0.45, 0.65, 0.55] }])(
  'keeps directional shadow texels fixed for light direction $direction',
  ({ direction }) => {
    const bounds = (x: number) => ({
      min: [-1, -1, -1] as [number, number, number],
      max: [1, 1, 1] as [number, number, number],
      model: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1]),
    });
    const worldOriginTexel = (x: number) => {
      const vp = fitDirectionalShadow(direction, [bounds(x)])!;
      const clip = vec3.transformMat4(vec3.create(), [0, 0, 0], vp);
      return [
        ((clip[0] + 1) * SHADOW_MAP_SIZE) / 2,
        ((clip[1] + 1) * SHADOW_MAP_SIZE) / 2,
      ];
    };
    const initial = worldOriginTexel(0);
    const smallMove = worldOriginTexel(0.0005);
    const moved = worldOriginTexel(0.02);
    for (let axis = 0; axis < 2; axis++) {
      expect(smallMove[axis]).toBeCloseTo(initial[axis], 3);
      const pixelShift = moved[axis] - initial[axis];
      expect(pixelShift).toBeCloseTo(Math.round(pixelShift), 3);
    }
  },
);

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

it('keeps a spotlight shadow caster visible when it crosses the light plane', () => {
  const crossing = {
    min: [-1, -1, -10] as [number, number, number],
    max: [1, 1, 10] as [number, number, number],
    model: identity,
  };
  const vp = fitSpotShadow([0, 0, 0], [0, 0, 1], Math.PI / 4, 50, [crossing]);
  expect(vp).not.toBeNull();
  const nearSurface = vec3.transformMat4(
    vec3.create(),
    vec3.fromValues(0, 0, 1),
    vp!,
  );
  expect(nearSurface[2]).toBeGreaterThan(-1);
  expect(nearSurface[2]).toBeLessThan(1);
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

it('keeps close point-shadow casters inside the near plane in large scenes', () => {
  const tall = {
    min: [-1, -1, 1] as [number, number, number],
    max: [1, 1, 200] as [number, number, number],
    model: identity,
  };
  const faces = fitPointShadow([0, 0, 0], 500, [tall]);
  expect(faces).toHaveLength(6);
  const nearSurface = vec3.transformMat4(
    vec3.create(),
    vec3.fromValues(0, 0, 1),
    faces![4],
  );
  expect(nearSurface[2]).toBeGreaterThan(-1);
  expect(nearSurface[2]).toBeLessThan(1);
});

it('culls point-shadow casters per face while keeping seam-crossing bounds', () => {
  const front = {
    min: [-1, -1, 10] as [number, number, number],
    max: [1, 1, 20] as [number, number, number],
    model: identity,
  };
  const seam = {
    min: [5, -1, 5] as [number, number, number],
    max: [15, 1, 15] as [number, number, number],
    model: identity,
  };
  const faces = fitPointShadow([0, 0, 0], 100, [front, seam])!;
  const frontCorners = meshWorldCorners(front);
  const seamCorners = meshWorldCorners(seam);
  expect(
    faces.map((face) => intersectsShadowFrustum(frontCorners, face)),
  ).toEqual([false, false, false, false, true, false]);
  expect(
    faces.map((face) => intersectsShadowFrustum(seamCorners, face)),
  ).toEqual([true, false, false, false, true, false]);
});

it('keeps point-shadow tap directions continuous across all six face edges', () => {
  const bounds = {
    min: [-150, -150, -150] as [number, number, number],
    max: [150, 150, 150] as [number, number, number],
    model: identity,
  };
  const faces = fitPointShadow([0, 0, 0], 500, [bounds])!;
  const faceForRay = (ray: vec3) => {
    const [x, y, z] = ray.map(Math.abs);
    if (x >= y && x >= z) return ray[0] >= 0 ? 0 : 1;
    if (y >= z) return ray[1] >= 0 ? 2 : 3;
    return ray[2] >= 0 ? 4 : 5;
  };
  POINT_SHADOW_FACES.forEach(({ direction, right, up }, face) => {
    for (const axis of [right, up]) {
      for (const sign of [-1, 1]) {
        const nearEdge = vec3.fromValues(
          ...direction.map(
            (value, index) => value * 100 + axis[index] * sign * 99.9,
          ),
        );
        const clip = vec3.transformMat4(vec3.create(), nearEdge, faces[face]);
        expect(Math.max(Math.abs(clip[0]), Math.abs(clip[1]))).toBeCloseTo(
          0.999,
          3,
        );
        const crossed = vec3.scaleAndAdd(
          vec3.create(),
          nearEdge,
          axis,
          sign * ((2 * 100 * 4) / 512),
        );
        const adjacent = faceForRay(crossed);
        expect(adjacent).not.toBe(face);
        const neighborClip = vec3.transformMat4(
          vec3.create(),
          crossed,
          faces[adjacent],
        );
        expect(
          Math.max(Math.abs(neighborClip[0]), Math.abs(neighborClip[1])),
        ).toBeLessThan(1);
      }
    }
  });
});
