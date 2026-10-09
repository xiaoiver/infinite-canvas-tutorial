import { AnchorName, type OBB } from '../../packages/ecs/src';
import {
  resizeOBB,
  resizePointToLocal,
  resizePointToWorld,
} from '../../packages/ecs/src/utils/transformer-resize';

const box: OBB = {
  x: 30,
  y: 40,
  width: 100,
  height: 50,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};
const free = {
  flipEnabled: true,
  lockAspectRatio: false,
  centeredScaling: false,
};
const handles = [
  [AnchorName.TOP_LEFT, 0, 0, 1, 1],
  [AnchorName.TOP_CENTER, 0.5, 0, 0.5, 1],
  [AnchorName.TOP_RIGHT, 1, 0, 0, 1],
  [AnchorName.MIDDLE_LEFT, 0, 0.5, 1, 0.5],
  [AnchorName.MIDDLE_RIGHT, 1, 0.5, 0, 0.5],
  [AnchorName.BOTTOM_LEFT, 0, 1, 1, 0],
  [AnchorName.BOTTOM_CENTER, 0.5, 1, 0.5, 0],
  [AnchorName.BOTTOM_RIGHT, 1, 1, 0, 0],
] as const;

function closePoint(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
) {
  expect(actual.x).toBeCloseTo(expected.x, 8);
  expect(actual.y).toBeCloseTo(expected.y, 8);
}

it('converts translated, rotated and reflected coordinates in both directions', () => {
  const obb = { ...box, rotation: Math.PI / 2, scaleX: -2, scaleY: 3 };
  closePoint(resizePointToWorld(obb, { x: 10, y: 5 }), { x: 15, y: 20 });
  closePoint(resizePointToLocal(obb, { x: 15, y: 20 }), { x: 10, y: 5 });
});

describe.each([
  { rotation: 0, scaleX: 1, scaleY: 1 },
  { rotation: Math.PI / 3, scaleX: -2, scaleY: 0.5 },
  { rotation: -Math.PI / 2, scaleX: 2, scaleY: -0.5 },
  { rotation: Math.PI, scaleX: -1, scaleY: -1 },
])('resize invariants in frame %o', (transform) => {
  it.each(handles)(
    'keeps the opposite handle fixed for %s',
    (anchor, mx, my, fx, fy) => {
      const obb = { ...box, ...transform };
      const original = { ...obb };
      const pointer = resizePointToWorld(obb, {
        x: mx === 0 ? -20 : mx === 1 ? 130 : 50,
        y: my === 0 ? -10 : my === 1 ? 80 : 25,
      });
      const result = resizeOBB(obb, anchor, pointer, free)!;
      closePoint(
        resizePointToWorld(result, {
          x: result.width * fx,
          y: result.height * fy,
        }),
        resizePointToWorld(obb, { x: obb.width * fx, y: obb.height * fy }),
      );
      closePoint(
        resizePointToWorld(result, {
          x: result.width * mx,
          y: result.height * my,
        }),
        pointer,
      );
      expect(result).toMatchObject(transform);
      expect(obb).toEqual(original);
    },
  );

  it.each(handles)(
    'preserves center and aspect ratio for %s',
    (anchor, mx, my) => {
      const obb = { ...box, ...transform };
      const pointer = resizePointToWorld(obb, {
        x: mx === 0 ? -30 : mx === 1 ? 160 : 50,
        y: my === 0 ? -20 : my === 1 ? 90 : 25,
      });
      const result = resizeOBB(obb, anchor, pointer, {
        ...free,
        centeredScaling: true,
        lockAspectRatio: true,
      })!;
      closePoint(
        resizePointToWorld(result, {
          x: result.width / 2,
          y: result.height / 2,
        }),
        resizePointToWorld(obb, { x: 50, y: 25 }),
      );
      expect(Math.abs(result.width / result.height)).toBeCloseTo(2, 8);
      expect(result).toMatchObject(transform);
    },
  );
});

it('crosses zero and reverses using the original gesture frame', () => {
  const frames = [150, 30, 0, -25, 60].map(
    (x) =>
      resizeOBB(
        box,
        AnchorName.BOTTOM_RIGHT,
        { x: box.x + x, y: box.y + 80 },
        free,
      )!,
  );
  expect(frames.map(({ width }) => width)).toEqual([150, 30, 0.01, -25, 60]);
  for (const result of frames) {
    expect(result).toMatchObject({ x: 30, y: 40, height: 80 });
  }
  const clamped = resizeOBB(
    box,
    AnchorName.TOP_LEFT,
    { x: 180, y: 120 },
    { ...free, flipEnabled: false },
  )!;
  expect(clamped.width).toBe(0.01);
  expect(clamped.height).toBe(0.01);
  closePoint(
    { x: clamped.x + clamped.width, y: clamped.y + clamped.height },
    { x: 130, y: 90 },
  );
});

it.each([
  { width: 0 },
  { height: 0 },
  { width: -1 },
  { height: -1 },
  { scaleX: 0 },
  { scaleY: 0 },
  { x: NaN },
  { y: Infinity },
])('rejects degenerate or non-finite input %o', (patch) => {
  expect(
    resizeOBB(
      { ...box, ...patch },
      AnchorName.BOTTOM_RIGHT,
      { x: 150, y: 100 },
      free,
    ),
  ).toBeUndefined();
});

it('rejects invalid pointers and non-box handles', () => {
  expect(
    resizeOBB(box, AnchorName.BOTTOM_RIGHT, { x: Infinity, y: 100 }, free),
  ).toBeUndefined();
  expect(
    resizeOBB(box, AnchorName.X1Y1, { x: 150, y: 100 }, free),
  ).toBeUndefined();
});
