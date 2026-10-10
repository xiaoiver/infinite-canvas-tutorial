import { mat4, vec3 } from 'gl-matrix';
import {
  createGizmoFrame,
  projectGizmoPoint,
  type GizmoPoint,
} from '../../packages/ecs/src/utils/gizmo-frame';
import { beginGizmoPointerGesture } from '../../packages/ecs/src/systems/pick3d/gizmo-pointer';
import {
  beginGizmoGestureAtPoint,
  type GizmoPose,
} from '../../packages/ecs/src/systems/pick3d/gizmo-gesture';
import type { Mesh3DPickScene } from '../../packages/ecs/src/utils/ray-casting';

const SIZE = 150 * Math.tan(Math.PI / 8);
const pose = (): GizmoPose => ({
  translation: [80, 80, 30],
  rotation: [0, 0, 0],
  scale: [2, 3, 4],
});
const linked = (
  width = 400,
  height = 240,
  zoom = 1,
  roll = 0,
  fovy = Math.PI / 4,
): Mesh3DPickScene => {
  const canvas = mat4.ortho(mat4.create(), 0, width, height, 0, -1, 1);
  mat4.rotateZ(canvas, canvas, roll);
  mat4.scale(canvas, canvas, [zoom, zoom, 1]);
  mat4.translate(canvas, canvas, [-20, -15, 0]);
  return {
    mode: 'linkedPerspective',
    canvasViewProjection: canvas as Float32Array,
    viewMatrix: mat4.fromTranslation(mat4.create(), [
      0,
      0,
      -height / (2 * zoom * Math.tan(fovy / 2)),
    ]) as Float32Array,
    projMatrix: mat4.perspective(
      mat4.create(),
      fovy,
      width / height,
      0.1,
      10000,
    ) as Float32Array,
  };
};
const standard = (orthographic = false): Mesh3DPickScene => ({
  mode: 'standard',
  viewMatrix: mat4.lookAt(
    mat4.create(),
    [200, 150, 300],
    [0, 0, 0],
    [0, 1, 0],
  ) as Float32Array,
  projMatrix: (orthographic
    ? mat4.ortho(mat4.create(), -200, 200, -120, 120, 0.1, 10000)
    : mat4.perspective(
        mat4.create(),
        Math.PI / 4,
        400 / 240,
        0.1,
        10000,
      )) as Float32Array,
});
const near = (
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  precision = 3,
) => {
  Array.from(expected).forEach((value, i) =>
    expect(actual[i]).toBeCloseTo(value, precision),
  );
};

it.each([
  [400, 240, 1, 0, 0],
  [240, 400, 2, 0.3, 40],
  [800, 200, 0.75, -0.4, -30],
])(
  'keeps linked handles in CSS pixels at %s × %s, zoom %s, roll %s and depth %s',
  (w, h, zoom, roll, z) => {
    const anchor: GizmoPoint = [80, 80, z];
    const frame = createGizmoFrame(linked(w, h, zoom, roll), anchor, w, h)!;
    expect(frame.scale).toBeCloseTo(SIZE / zoom, 3);
    const center = projectGizmoPoint(frame, anchor)!;
    const x = projectGizmoPoint(frame, [80 + frame.scale, 80, z])!;
    expect(Math.hypot(x[0] - center[0], x[1] - center[1])).toBeCloseTo(SIZE, 3);
    const depth = projectGizmoPoint(frame, [80, 80, z + frame.scale], true)!;
    near(
      depth.map((value, i) => value - center[i]),
      [
        (SIZE * 0.5) / Math.hypot(0.5, 0.55),
        (SIZE * 0.55) / Math.hypot(0.5, 0.55),
      ],
    );
  },
);

it.each([false, true])(
  'keeps tilted, off-axis standard handles at a stable size (orthographic: %s)',
  (orthographic) => {
    const scene = standard(orthographic);
    for (const anchor of [
      [0, 0, 0],
      [60, -40, -80],
    ] as GizmoPoint[]) {
      const frame = createGizmoFrame(scene, anchor, 400, 240)!;
      const right = [
        scene.viewMatrix[0],
        scene.viewMatrix[4],
        scene.viewMatrix[8],
      ];
      const a = projectGizmoPoint(frame, anchor)!;
      const b = projectGizmoPoint(
        frame,
        anchor.map((value, i) => value + right[i] * frame.scale) as GizmoPoint,
      )!;
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(150, 2);
    }
  },
);

it('keeps linked orthographic size and ignores perspective FOV for linked display size', () => {
  const scene = linked(400, 240, 2, 0, Math.PI / 2);
  const frame = createGizmoFrame(scene, pose().translation, 400, 240)!;
  expect(frame.scale).toBeCloseTo(SIZE / 2, 3);
  if (scene.mode !== 'linkedPerspective')
    throw new Error('Expected linked scene');
  const ortho = createGizmoFrame(
    {
      mode: 'orthographic2d',
      projMatrix: scene.canvasViewProjection,
      viewMatrix: mat4.create() as Float32Array,
    },
    pose().translation,
    400,
    240,
  )!;
  expect(ortho.scale).toBeCloseTo(frame.scale, 3);
});

it.each(['x', 'y', 'z'] as const)(
  'maps the displayed linked %s axis without preview feedback',
  (axis) => {
    const initial = pose();
    const frame = createGizmoFrame(
      linked(400, 240, 2, 0.3),
      initial.translation,
      400,
      240,
    )!;
    const start = projectGizmoPoint(frame, initial.translation, true)!;
    const index = 'xyz'.indexOf(axis);
    const target: GizmoPoint = [...initial.translation];
    target[index] += 20;
    const end = projectGizmoPoint(frame, target, true)!;
    const gesture = beginGizmoPointerGesture(
      initial,
      axis,
      'translate',
      frame,
      start,
      initial.translation,
    )!;
    const result = gesture.update(end)!;
    near(result.translation, target);
    expect(result.rotation).toEqual(initial.rotation);
    expect(result.scale).toEqual(initial.scale);
    near(gesture.update(end)!.translation, target);
    near(gesture.update(start)!.translation, initial.translation);
    expect(initial).toEqual(pose());
  },
);

it.each(['xy', 'xz', 'yz'] as const)(
  'inverts the linked %s plane at nonzero depth',
  (axis) => {
    const initial = pose();
    const frame = createGizmoFrame(
      linked(400, 240, 1.7, 0.2),
      initial.translation,
      400,
      240,
    )!;
    const start = projectGizmoPoint(frame, initial.translation, true)!;
    const target = initial.translation.map(
      (value, i) => value + (axis.includes('xyz'[i]) ? 12 + i * 4 : 0),
    ) as GizmoPoint;
    const end = projectGizmoPoint(frame, target, true)!;
    // Starting off the origin must not snap the object to the pointer.
    const offset: [number, number] = [9, 13];
    const press: [number, number] = [
      start[0] + offset[0],
      start[1] + offset[1],
    ];
    const gesture = beginGizmoPointerGesture(
      initial,
      axis,
      'translate',
      frame,
      press,
      initial.translation,
    )!;
    near(
      gesture.update([end[0] + offset[0], end[1] + offset[1]])!.translation,
      target,
    );
    expect(gesture.update([Number.NaN, 0])).toBeUndefined();
    near(gesture.update(press)!.translation, initial.translation);
  },
);

it.each(['x', 'y', 'z'] as const)(
  'rotates a tilted linked local %s ring using the displayed projection',
  (axis) => {
    const initial = pose();
    initial.rotation = [0.4, -0.6, 0.8];
    const frame = createGizmoFrame(
      linked(400, 240, 1.4, -0.3),
      initial.translation,
      400,
      240,
    )!;
    const rotation = mat4.create();
    mat4.rotateX(rotation, rotation, initial.rotation[0]);
    mat4.rotateY(rotation, rotation, initial.rotation[1]);
    mat4.rotateZ(rotation, rotation, initial.rotation[2]);
    const local: GizmoPoint = axis === 'x' ? [0, 20, 0] : [20, 0, 0];
    const localAxis: GizmoPoint =
      axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
    const world = (p: vec3): GizmoPoint => {
      const rotated = vec3.transformMat4(vec3.create(), p, rotation);
      return initial.translation.map(
        (value, i) => value + rotated[i],
      ) as GizmoPoint;
    };
    const first = world(local);
    const gesture = beginGizmoPointerGesture(
      initial,
      axis,
      'rotate',
      frame,
      projectGizmoPoint(frame, first)!,
      first,
    )!;
    for (const angle of [0.1, 0.3, 0.7, 0]) {
      const turn = mat4.fromRotation(mat4.create(), angle, localAxis);
      const target = world(vec3.transformMat4(vec3.create(), local, turn));
      const result = gesture.update(projectGizmoPoint(frame, target)!)!;
      const actual = mat4.create();
      mat4.rotateX(actual, actual, result.rotation[0]);
      mat4.rotateY(actual, actual, result.rotation[1]);
      mat4.rotateZ(actual, actual, result.rotation[2]);
      near(actual, mat4.multiply(mat4.create(), rotation, turn));
      expect(result.translation).toEqual(initial.translation);
    }
  },
);

it.each([false, true])(
  'preserves standard camera axis dragging (orthographic: %s)',
  (orthographic) => {
    const initial = pose();
    const frame = createGizmoFrame(
      standard(orthographic),
      initial.translation,
      400,
      240,
    )!;
    const press: GizmoPoint = [100, 80, 30];
    const target: GizmoPoint = [120, 80, 30];
    const gesture = beginGizmoPointerGesture(
      initial,
      'x',
      'translate',
      frame,
      projectGizmoPoint(frame, press)!,
      press,
    )!;
    near(
      gesture.update(projectGizmoPoint(frame, target)!)!.translation,
      [100, 80, 30],
      2,
    );
  },
);

it('rejects invalid dimensions, behind-camera anchors and singular projections', () => {
  expect(createGizmoFrame(linked(), [0, 0, 0], 0, 240)).toBeUndefined();
  expect(
    createGizmoFrame(standard(), [400, 300, 600], 400, 240),
  ).toBeUndefined();
  const collapsed = standard();
  collapsed.projMatrix = new Float32Array(16);
  expect(createGizmoFrame(collapsed, [0, 0, 0], 400, 240)).toBeUndefined();
  const frame = createGizmoFrame(standard(), pose().translation, 400, 240)!;
  frame.scene = collapsed;
  expect(
    beginGizmoPointerGesture(
      pose(),
      'x',
      'translate',
      frame,
      [0, 0],
      pose().translation,
    ),
  ).toBeUndefined();
});

it('rejects invisible constraints instead of starting a non-finite gesture', () => {
  const initial = pose();
  const frame = createGizmoFrame(linked(), initial.translation, 400, 240)!;
  const pointer = projectGizmoPoint(frame, initial.translation)!;
  expect(
    beginGizmoPointerGesture(
      initial,
      'none',
      'translate',
      frame,
      pointer,
      initial.translation,
    ),
  ).toBeUndefined();
  expect(
    beginGizmoPointerGesture(
      initial,
      'xy',
      'rotate',
      frame,
      pointer,
      initial.translation,
    ),
  ).toBeUndefined();
  // An unrotated X ring is edge-on in the linked view.
  expect(
    beginGizmoPointerGesture(
      initial,
      'x',
      'rotate',
      frame,
      pointer,
      initial.translation,
    ),
  ).toBeUndefined();
  frame.zBias = [0, 0];
  expect(
    beginGizmoPointerGesture(
      initial,
      'z',
      'translate',
      frame,
      pointer,
      initial.translation,
    ),
  ).toBeUndefined();
  expect(
    beginGizmoGestureAtPoint(initial, 'none', 'translate', initial.translation),
  ).toBeUndefined();
  expect(
    beginGizmoGestureAtPoint(initial, 'xy', 'rotate', initial.translation),
  ).toBeUndefined();
});
