import { mat4, vec3 } from 'gl-matrix';
import {
  beginGizmoGesture,
  updateGizmoGesture,
  type GizmoPose,
} from '../../packages/ecs/src/systems/pick3d/gizmo-gesture';
import type { Ray } from '../../packages/ecs/src/utils/ray-casting';

const pose = (): GizmoPose => ({
  translation: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [2, 3, 4],
});
const ray = (x: number, y: number): Ray => ({
  origin: [x, y, 100],
  direction: [0, 0, -1],
});

it.each(['x', 'y', 'xy'] as const)(
  'moves the %s constraint with a front-facing orthographic camera',
  (axis) => {
    const initial = pose();
    const gesture = beginGizmoGesture(initial, axis, 'translate', ray(20, 30))!;
    const result = updateGizmoGesture(gesture, ray(35, 55))!;
    expect(result.translation).toEqual([
      axis.includes('x') ? 15 : 0,
      axis.includes('y') ? 25 : 0,
      0,
    ]);
    expect(result.scale).toEqual([2, 3, 4]);
    expect(initial).toEqual(pose());
    // Every sample is relative to the press, not the previously applied pose.
    expect(updateGizmoGesture(gesture, ray(20, 30))).toEqual(initial);
  },
);

it('rejects degenerate constraints and leaves a valid gesture unchanged on a missed plane', () => {
  expect(
    beginGizmoGesture(pose(), 'z', 'translate', ray(0, 0)),
  ).toBeUndefined();
  expect(
    beginGizmoGesture(pose(), 'none', 'translate', ray(0, 0)),
  ).toBeUndefined();
  expect(beginGizmoGesture(pose(), 'xy', 'rotate', ray(0, 0))).toBeUndefined();
  const gesture = beginGizmoGesture(pose(), 'xy', 'translate', ray(0, 0))!;
  expect(
    updateGizmoGesture(gesture, { origin: [1, 1, 100], direction: [1, 0, 0] }),
  ).toBeUndefined();
  expect(updateGizmoGesture(gesture, ray(10, 20))!.translation).toEqual([
    10, 20, 0,
  ]);
});

it.each(['x', 'y', 'z'] as const)(
  'rotates about the local %s ring on an already rotated object',
  (axis) => {
    const initial = pose();
    initial.rotation = [0.4, -0.6, 0.8];
    const matrix = mat4.create();
    mat4.rotateX(matrix, matrix, initial.rotation[0]);
    mat4.rotateY(matrix, matrix, initial.rotation[1]);
    mat4.rotateZ(matrix, matrix, initial.rotation[2]);
    const point: [number, number, number] =
      axis === 'x' ? [0, 20, 0] : [20, 0, 0];
    const localAxis: [number, number, number] =
      axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
    const normal = vec3.transformMat4(vec3.create(), localAxis, matrix);
    const toRay = (p: vec3): Ray => {
      const world = vec3.transformMat4(vec3.create(), p, matrix);
      return {
        origin: [
          world[0] + normal[0] * 100,
          world[1] + normal[1] * 100,
          world[2] + normal[2] * 100,
        ],
        direction: [-normal[0], -normal[1], -normal[2]],
      };
    };
    const gesture = beginGizmoGesture(initial, axis, 'rotate', toRay(point))!;
    const turn = mat4.fromRotation(mat4.create(), 0.7, localAxis);
    const result = updateGizmoGesture(
      gesture,
      toRay(vec3.transformMat4(vec3.create(), point, turn)),
    )!;
    const expected = mat4.multiply(mat4.create(), matrix, turn);
    const actual = mat4.create();
    mat4.rotateX(actual, actual, result.rotation[0]);
    mat4.rotateY(actual, actual, result.rotation[1]);
    mat4.rotateZ(actual, actual, result.rotation[2]);
    Array.from(actual).forEach((value, i) =>
      expect(value).toBeCloseTo(expected[i], 5),
    );
    expect(result.translation).toEqual(initial.translation);
    expect(result.scale).toEqual(initial.scale);
  },
);

it('tracks rotation across the ±π boundary and can return to its starting pose', () => {
  const gesture = beginGizmoGesture(pose(), 'z', 'rotate', ray(20, 0))!;
  for (const angle of [1, 2, 3, 4, 5, 6]) {
    updateGizmoGesture(
      gesture,
      ray(20 * Math.cos(angle), 20 * Math.sin(angle)),
    );
    expect(gesture.angle).toBeCloseTo(angle);
  }
  const final = updateGizmoGesture(gesture, ray(20, 0))!;
  expect(gesture.angle).toBeCloseTo(2 * Math.PI);
  final.rotation.forEach((value) => expect(value).toBeCloseTo(0));
});
