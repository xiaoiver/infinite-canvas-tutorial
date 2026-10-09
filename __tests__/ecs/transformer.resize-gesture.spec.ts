import {
  AABB,
  AnchorName,
  Circle,
  ComputedPoints,
  GlobalTransform,
  Line,
  Mat3,
  Polyline,
  Stroke,
  TransformableStatus,
  type SerializedNode,
  type Entity,
} from '../../packages/ecs/src';
import {
  getResizePointerOffset,
  updateResizeGesture,
  type ResizeSelection,
} from '../../packages/ecs/src/systems/select/resize-gesture';
import { createSnappingScene } from '../helpers/snapping-scene';

const box = {
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
};
function selection(anchor = AnchorName.BOTTOM_RIGHT): ResizeSelection {
  return {
    obb: { ...box },
    resizingAnchorName: anchor,
    sin: 1 / Math.sqrt(5),
    cos: 2 / Math.sqrt(5),
    label: { style: {} } as HTMLDivElement,
  };
}
function effects() {
  return { fit: jest.fn(), snapLines: jest.fn(), rebindEndpoint: jest.fn() };
}
const handles = [
  [AnchorName.TOP_LEFT, 1, 1],
  [AnchorName.TOP_CENTER, 0.5, 1],
  [AnchorName.TOP_RIGHT, 0, 1],
  [AnchorName.MIDDLE_LEFT, 1, 0.5],
  [AnchorName.MIDDLE_RIGHT, 0, 0.5],
  [AnchorName.BOTTOM_LEFT, 1, 0],
  [AnchorName.BOTTOM_CENTER, 0.5, 0],
  [AnchorName.BOTTOM_RIGHT, 0, 0],
] as const;

it.each(handles)(
  'passes the opposite text origin for handle %s',
  (anchor, x, y) => {
    const { api, state, transformer } = createSnappingScene([
      { id: 'selected', bounds: new AABB(0, 0, 100, 50) },
    ]);
    state.snapToObjectsEnabled = false;
    const callbacks = effects();
    updateResizeGesture(
      api,
      130,
      80,
      false,
      false,
      selection(anchor),
      callbacks,
    );
    expect(callbacks.fit).toHaveBeenCalledTimes(1);
    expect(callbacks.fit.mock.calls[0][1]).toEqual({ x, y });
    expect(callbacks.snapLines).toHaveBeenCalledWith([]);
    expect(callbacks.rebindEndpoint).not.toHaveBeenCalled();
    expect(transformer.status).toBe(TransformableStatus.RESIZING);
  },
);

it.each([
  [true, false, true],
  [false, true, false],
  [undefined, true, true],
] as const)(
  'honors per-node aspect preference %s over modifier %s',
  (lockAspectRatio, modifier, locked) => {
    const { api, state } = createSnappingScene([
      { id: 'selected', bounds: new AABB(0, 0, 100, 50), lockAspectRatio },
    ]);
    state.snapToObjectsEnabled = false;
    const callbacks = effects();
    updateResizeGesture(api, 120, 80, modifier, false, selection(), callbacks);
    const result = callbacks.fit.mock.calls[0][0];
    expect(result.width / result.height).toBeCloseTo(locked ? 2 : 1.5);
  },
);

it('uses the modifier for multi-selection and center origin for centered scaling', () => {
  const { api, state } = createSnappingScene([
    { id: 'selected', bounds: new AABB(0, 0, 100, 50), lockAspectRatio: false },
    { id: 'second', bounds: new AABB(0, 0, 100, 50), lockAspectRatio: false },
  ]);
  state.layersSelected.push('second');
  const callbacks = effects();
  updateResizeGesture(api, 150, 100, true, true, selection(), callbacks);
  const [result, origin] = callbacks.fit.mock.calls[0];
  expect(result.width / result.height).toBeCloseTo(2);
  expect(result.x + result.width / 2).toBeCloseTo(50);
  expect(result.y + result.height / 2).toBeCloseTo(25);
  expect(origin).toEqual({ x: 0.5, y: 0.5 });
});

it('snaps a rotated, flipped side along its world-space direction', () => {
  const { api } = createSnappingScene([
    { id: 'selected', bounds: new AABB(150, 100, 200, 200) },
    { id: 'reference', bounds: new AABB(300, 68, 350, 88) },
  ]);
  const frame = selection(AnchorName.MIDDLE_RIGHT);
  frame.obb = { ...box, x: 200, y: 200, rotation: Math.PI / 2, scaleX: -1 };
  const callbacks = effects();
  // Off-axis motion is projected back onto the middle-right handle's ray.
  updateResizeGesture(api, 170, 70, false, false, frame, callbacks);
  const result = callbacks.fit.mock.calls[0][0];
  expect(result.width).toBeCloseTo(132);
  expect(result.height).toBeCloseTo(50);
  expect(result.x).toBeCloseTo(200);
  expect(result.y).toBeCloseTo(200);
  expect(callbacks.snapLines).toHaveBeenCalledWith([
    {
      type: 'points',
      points: [
        [175, 68],
        [300, 68],
        [350, 68],
      ],
    },
  ]);
});

it.each([AnchorName.TOP_CENTER, AnchorName.BOTTOM_CENTER])(
  'projects off-axis pointer motion before snapping %s',
  (anchor) => {
    const { api } = createSnappingScene([
      { id: 'selected', bounds: new AABB(0, 0, 100, 50) },
      { id: 'reference', bounds: new AABB(200, 82, 240, 102) },
    ]);
    const callbacks = effects();
    updateResizeGesture(
      api,
      70,
      80,
      false,
      false,
      selection(anchor),
      callbacks,
    );
    const result = callbacks.fit.mock.calls[0][0];
    expect(result.x).toBe(0);
    expect(result.width).toBe(100);
    expect(result.y).toBe(anchor === AnchorName.TOP_CENTER ? 82 : 0);
    expect(result.height).toBe(anchor === AnchorName.TOP_CENTER ? -32 : 82);
    expect(callbacks.snapLines).toHaveBeenCalledWith([
      {
        type: 'points',
        points: [
          [50, 82],
          [200, 82],
          [240, 82],
        ],
      },
    ]);
  },
);

describe.each(['line', 'rough-line', 'polyline'] as const)(
  '%s endpoints',
  (type) => {
    it.each([AnchorName.X1Y1, AnchorName.X2Y2])(
      'converts %s to local geometry without moving the opposite endpoint',
      (anchor) => {
        const { api } = createSnappingScene([
          { id: 'selected', bounds: new AABB(0, 0, 100, 50) },
        ]);
        const points = [
          [10, 20],
          [25, 80],
          [40, 50],
        ] as [number, number][];
        const node = { id: 'selected', type } as SerializedNode;
        const components = new Map<unknown, unknown>([
          // A translated, rotated and reflected parent frame: world=(200-3*y, 300-2*x).
          [
            GlobalTransform,
            { matrix: new Mat3(0, -2, 0, -3, 0, 0, 200, 300, 1) },
          ],
          [ComputedPoints, {}],
          [Stroke, { alignment: 'center', width: 1 }],
          type === 'polyline'
            ? [Polyline, { points }]
            : [Line, { x1: 10, y1: 20, x2: 40, y2: 50 }],
        ]);
        const entity = {
          has: (component: unknown) => components.has(component),
          read: (component: unknown) => components.get(component),
          write: (component: unknown) => components.get(component),
        } as unknown as Entity;
        api.getNodeById = () => node;
        api.getEntity = () => entity;
        api.updateNode = jest.fn();
        const callbacks = effects();
        updateResizeGesture(
          api,
          110,
          270,
          false,
          false,
          selection(anchor),
          callbacks,
        );
        const start = anchor === AnchorName.X1Y1;
        const update = api.updateNode as jest.Mock;
        expect(update).toHaveBeenCalledTimes(1);
        expect(update.mock.calls[0][0]).toBe(node);
        if (type === 'polyline') {
          const actual = update.mock.calls[0][1].points
            .split(' ')
            .map((pair: string) => pair.split(',').map(Number));
          const expected = start
            ? [
                [15, 30],
                [25, 80],
                [40, 50],
              ]
            : [
                [10, 20],
                [25, 80],
                [15, 30],
              ];
          actual.forEach((pair: number[], i: number) =>
            pair.forEach((value, axis) =>
              expect(value).toBeCloseTo(expected[i][axis], 5),
            ),
          );
          expect(points).toEqual([
            [10, 20],
            [25, 80],
            [40, 50],
          ]);
        } else {
          const expected = start
            ? { x1: 15, y1: 30, x2: 40, y2: 50 }
            : { x1: 10, y1: 20, x2: 15, y2: 30 };
          for (const [key, value] of Object.entries(expected)) {
            expect(update.mock.calls[0][1][key]).toBeCloseTo(value, 5);
          }
        }
        expect(callbacks.rebindEndpoint).toHaveBeenCalledWith(
          entity,
          node,
          110,
          270,
        );
        expect(callbacks.fit).not.toHaveBeenCalled();
      },
    );
  },
);

it.each([
  'missing entity',
  'missing transform',
  'singular transform',
  'missing line',
  'unsupported shape',
])('does not update endpoint geometry with %s', (scenario) => {
  const { api } = createSnappingScene([
    { id: 'selected', bounds: new AABB(0, 0, 100, 50) },
  ]);
  api.getNodeById = () => ({
    id: 'selected',
    zIndex: 0,
    type: scenario === 'unsupported shape' ? 'rect' : 'line',
  });
  api.getEntity = () =>
    scenario === 'missing entity'
      ? undefined
      : ({
          has: (component: unknown) =>
            component === GlobalTransform && scenario !== 'missing transform',
          read: () => ({
            matrix:
              scenario === 'singular transform' ? Mat3.ZERO : Mat3.IDENTITY,
          }),
        } as unknown as Entity);
  api.updateNode = jest.fn();
  const callbacks = effects();
  updateResizeGesture(
    api,
    10,
    20,
    false,
    false,
    selection(AnchorName.X1Y1),
    callbacks,
  );
  expect(api.updateNode).not.toHaveBeenCalled();
  expect(callbacks.fit).not.toHaveBeenCalled();
});

it.each([false, true])(
  'snaps an aspect-locked corner without breaking the ratio (centered=%s)',
  (centered) => {
    const { api } = createSnappingScene([
      { id: 'selected', bounds: new AABB(0, 0, 100, 50) },
      {
        id: 'reference',
        bounds: new AABB(centered ? 160 : 110, 200, 300, 250),
      },
    ]);
    const callbacks = effects();
    updateResizeGesture(
      api,
      centered ? 146 : 96,
      centered ? 97 : 72,
      true,
      centered,
      selection(),
      callbacks,
    );
    const result = callbacks.fit.mock.calls[0][0];
    expect(result.width).toBeCloseTo(centered ? 220 : 110);
    expect(result.height).toBeCloseTo(centered ? 110 : 55);
    expect(result.x).toBeCloseTo(centered ? -60 : 0);
    expect(result.y).toBeCloseTo(centered ? -30 : 0);
    expect(callbacks.snapLines.mock.calls[0][0]).toHaveLength(1);
  },
);

it('does not fit a degenerate selection or a removed endpoint', () => {
  const { api, state } = createSnappingScene([]);
  state.layersSelected = [];
  const callbacks = effects();
  const frame = selection();
  frame.obb.width = 0;
  updateResizeGesture(api, 10, 20, false, false, frame, callbacks);
  updateResizeGesture(
    api,
    10,
    20,
    false,
    false,
    selection(AnchorName.X1Y1),
    callbacks,
  );
  expect(callbacks.fit).not.toHaveBeenCalled();
  expect(callbacks.rebindEndpoint).not.toHaveBeenCalled();
});

it.each([
  ...handles.map(
    ([anchor, fx, fy]) =>
      [anchor, (1 - fx) * 100, (1 - fy) * 50, false] as const,
  ),
  [AnchorName.X1Y1, 7, 11, true],
  [AnchorName.X2Y2, 90, 40, true],
] as const)(
  'preserves padded pointer offset for %s using the owning mask',
  (anchor, hx, hy, endpoint) => {
    const { api, transformer } = createSnappingScene([]);
    const circle = (cx: number, cy: number) =>
      ({
        read: (component: unknown) => {
          expect(component).toBe(Circle);
          return { cx, cy };
        },
      } as unknown as Entity);
    transformer.tlAnchor = circle(0, 0);
    transformer.brAnchor = circle(100, 50);
    transformer.x1y1Anchor = circle(7, 11);
    transformer.x2y2Anchor = circle(90, 40);
    transformer.mask = {} as unknown as Entity;
    transformer.lineMask = {} as unknown as Entity;
    api.transformer2Canvas = jest.fn(({ x, y }) => ({
      x: 200 - 2 * y,
      y: 300 - 2 * x,
    }));
    api.viewport2Canvas = jest.fn(({ x, y }) => ({
      x: x / 4 + 10,
      y: y / 4 + 20,
    }));
    expect(getResizePointerOffset(api, anchor, 100, 200)).toEqual([
      35 - (200 - 2 * hy),
      70 - (300 - 2 * hx),
    ]);
    expect(api.transformer2Canvas).toHaveBeenCalledWith(
      { x: hx, y: hy },
      endpoint ? transformer.lineMask : transformer.mask,
    );
  },
);
