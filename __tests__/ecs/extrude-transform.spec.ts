import { mat3, mat4 } from 'gl-matrix';
import {
  Camera,
  Children,
  ComputedBounds,
  Extrude3D,
  GlobalTransform,
  Mat3,
  Rect,
  Transform,
  type Entity,
} from '../../packages/ecs/src';
import {
  extrude3DFromWire,
  extrude3DToWire,
} from '../../packages/ecs/src/utils/extrude3d';
import {
  resolveExtrudeCompanionTransform,
  resolveExtrudeSourceTransform,
} from '../../packages/ecs/src/utils/extrude3d-transform';
import { resolveCanvasSourceOrigin } from '../../packages/ecs/src/utils/canvas-source-origin';

function entity(values: Map<any, any>) {
  return {
    has: (type: any) => values.has(type),
    read: (type: any) => values.get(type),
  } as unknown as Entity;
}
function source(rotation: [number, number, number] = [0, 0, 0], base = 0) {
  const values = new Map<any, any>([
    [
      Transform,
      { translation: { x: 60, y: 60 }, scale: { x: 1, y: 1 }, rotation: 0 },
    ],
    [Rect, { width: 40, height: 40 }],
    [
      ComputedBounds,
      {
        geometryWorldBounds: { minX: 60, minY: 60, maxX: 100, maxY: 100 },
        transformOBB: { rotation: base },
      },
    ],
    [Extrude3D, { depth: 20, z: 10, rotation }],
  ]);
  return { entity: entity(values), values };
}
function matrix(rotation: readonly number[]) {
  const result = mat4.create();
  mat4.rotateX(result, result, rotation[0]);
  mat4.rotateY(result, result, rotation[1]);
  mat4.rotateZ(result, result, rotation[2]);
  return result;
}
const near = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  Array.from(b).forEach((v, i) => expect(a[i]).toBeCloseTo(v, 5));

it.each([
  true,
  25,
  {},
  { depth: 0 },
  { depth: -1 },
  { depth: Infinity },
  { depth: false },
  { z: NaN, rotation: [1, 2] },
  { rotation: [0, Infinity, 0] },
])('loads and normalizes extrusion wire values: %j', (value) => {
  const normalized = extrude3DFromWire(value as any)!;
  expect(normalized.depth).toBe(value === 25 ? 25 : 100);
  expect(normalized.z).toBe(0);
  expect(normalized.rotation).toEqual([0, 0, 0]);
});
it.each([false, undefined])('disables extrusion for %s', (value) =>
  expect(extrude3DFromWire(value)).toBeUndefined(),
);
it('copies wire arrays and retains the compact legacy representation', () => {
  const rotation: [number, number, number] = [0.2, -0.3, 0.4];
  const options = { depth: 20, z: 15, rotation };
  const normalized = extrude3DFromWire(options)!;
  rotation[0] = 0;
  expect(normalized.rotation[0]).toBe(0.2);
  expect(extrude3DToWire({ depth: 100, z: 0, rotation: [0, 0, 0] }, true)).toBe(
    true,
  );
  expect(extrude3DToWire({ depth: 20, z: 0, rotation: [0, 0, 0] })).toBe(20);
  expect(extrude3DToWire(normalized)).toEqual({
    depth: 20,
    z: 15,
    rotation: [0.2, -0.3, 0.4],
  });
});

it.each([
  { rotation: [0.2, -0.3, 0.4], base: 0.6 },
  { rotation: [0.2, Math.PI / 2, 0.4], base: 0 },
  { rotation: [0.2, -Math.PI / 2, -0.4], base: 0 },
  { rotation: [-0.7, 0.8, -1.2], base: -1.1 },
])(
  'round-trips composed local rotation without Euler-axis drift: %j',
  ({ rotation, base }) => {
    const fixture = source(rotation as [number, number, number], base);
    const pose = resolveExtrudeCompanionTransform(fixture.entity, true)!;
    const expected = mat4.multiply(
      mat4.create(),
      mat4.fromZRotation(mat4.create(), base),
      matrix(rotation),
    );
    near(matrix(pose.rotation), expected);
    const patch = resolveExtrudeSourceTransform(fixture.entity, pose, true)!;
    near(matrix(patch.extrude.rotation), matrix(rotation));
    expect(patch.extrude.z).toBe(10);
    expect(patch.extrude.depth).toBe(20);
  },
);

it('round-trips legacy Y-up coordinates and keeps thickness separate from elevation', () => {
  const fixture = source();
  const pose = resolveExtrudeCompanionTransform(fixture.entity, false)!;
  expect(pose.translation).toEqual([80, -80, 0]);
  pose.translation = [90, -100, 30];
  const patch = resolveExtrudeSourceTransform(fixture.entity, pose, false)!;
  expect(patch).toMatchObject({ x: 70, y: 80, extrude: { depth: 20, z: 40 } });
  pose.scale[2] = 50;
  expect(
    resolveExtrudeSourceTransform(fixture.entity, pose, false)!.extrude,
  ).toMatchObject({ depth: 50, z: 55 });
});

it('rejects invalid poses and singular parent mappings before writing a source preview', () => {
  const fixture = source();
  const pose = resolveExtrudeCompanionTransform(fixture.entity, true)!;
  for (const invalid of [NaN, Infinity]) {
    expect(
      resolveExtrudeSourceTransform(
        fixture.entity,
        { ...pose, translation: [invalid, 0, 0] },
        true,
      ),
    ).toBeUndefined();
  }
  expect(
    resolveExtrudeSourceTransform(
      fixture.entity,
      { ...pose, scale: [1, 1, 0] },
      true,
    ),
  ).toBeUndefined();
  fixture.values.set(Children, {
    parent: entity(
      new Map([
        [
          GlobalTransform,
          { matrix: Mat3.fromGLMat3(mat3.fromScaling(mat3.create(), [0, 1])) },
        ],
      ]),
    ),
  });
  expect(
    resolveExtrudeSourceTransform(fixture.entity, pose, true),
  ).toBeUndefined();
  fixture.values.set(Children, { parent: entity(new Map([[Camera, {}]])) });
  expect(
    resolveExtrudeSourceTransform(fixture.entity, pose, true),
  ).toBeDefined();
  fixture.values.delete(Transform);
  expect(resolveCanvasSourceOrigin(fixture.entity, [0, 0])).toBeUndefined();
});

it('does not manufacture geometry from missing components or empty bounds', () => {
  const fixture = source();
  fixture.values.get(ComputedBounds).geometryWorldBounds.maxX = 60;
  expect(
    resolveExtrudeCompanionTransform(fixture.entity, true),
  ).toBeUndefined();
  fixture.values.delete(ComputedBounds);
  expect(
    resolveExtrudeCompanionTransform(fixture.entity, true),
  ).toBeUndefined();
  const other = source();
  const pose = resolveExtrudeCompanionTransform(other.entity, true)!;
  expect(
    resolveExtrudeSourceTransform(fixture.entity, pose, true),
  ).toBeUndefined();
  other.values.delete(Extrude3D);
  expect(
    resolveExtrudeSourceTransform(other.entity, pose, true),
  ).toBeUndefined();
});
