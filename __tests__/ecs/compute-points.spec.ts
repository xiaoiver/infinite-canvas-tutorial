import {
  API,
  ComputedBounds,
  ComputedPoints,
  Polyline,
  type SerializedNode,
  Stroke,
  type PolylineSerializedNode,
} from '../../packages/ecs/src';
import {
  maybeShiftPoints,
  shiftPoints,
} from '../../packages/ecs/src/systems/ComputePoints';
import { createDocumentWorld } from '../helpers/ecs-document';

const polyline = (
  patch: Partial<PolylineSerializedNode> = {},
): PolylineSerializedNode => ({
  id: 'line',
  type: 'polyline',
  zIndex: 0,
  x: 0,
  y: 0,
  width: 20,
  height: 20,
  points: '0,0 20,0 20,20',
  ...patch,
});

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
beforeAll(async () => {
  world = await createDocumentWorld(2);
});
afterAll(async () => {
  await world?.dispose();
});

it('loads a polyline without stroke geometry', async () => {
  const [api] = world.apis;
  await world.reset(api, [polyline()]);
  await world.frame();
  const entity = api.getEntity(api.getNodeById('line'));
  expect(entity.has(Stroke)).toBe(false);
  expect(entity.read(ComputedPoints).shiftedPoints).toEqual([
    [0, 0],
    [20, 0],
    [20, 20],
  ]);
});

it('recomputes the offset after a stroke-only edit and undo', async () => {
  const [api] = world.apis;
  const points = () =>
    api.getEntity(api.getNodeById('line')).read(ComputedPoints).shiftedPoints;
  await world.reset(api, [
    polyline({
      strokes: [{ type: 'solid', value: 'red' }],
      strokeWidth: 4,
      strokeAlignment: 'inner',
    }),
  ]);
  await world.frame();
  expect(points()).toEqual([
    [0, 2],
    [18, 2],
    [18, 20],
  ]);
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('line'), { strokeWidth: 8 }),
  );
  await world.frame();
  expect(points()).toEqual([
    [0, 4],
    [16, 4],
    [16, 20],
  ]);
  await world.history(api, 'undo');
  await world.frame();
  expect(points()).toEqual([
    [0, 2],
    [18, 2],
    [18, 20],
  ]);
});

it('keeps coincident points finite when there is no segment to offset', () => {
  expect(
    shiftPoints(
      [
        [3, 4],
        [3, 4],
      ],
      true,
      4,
    ),
  ).toEqual([
    [3, 4],
    [3, 4],
  ]);
});

const source: [number, number][] = [
  [0, 0],
  [20, 0],
  [20, 20],
];
const state = (api: API) => {
  const e = api.getEntity(api.getNodeById('line'));
  const b = e.read(ComputedBounds).geometryBounds;
  return structuredClone({
    points: e.read(ComputedPoints).shiftedPoints,
    geometry: [b.minX, b.minY, b.maxX, b.maxY],
  });
};
async function reloadMatches(api: API) {
  const reloaded = world.apis[1];
  await world.reset(reloaded, structuredClone(api.getNodes()));
  await world.frame();
  expect(state(reloaded)).toEqual(state(api));
}

it.each([
  ['center', source],
  [
    'inner',
    [
      [0, 2],
      [18, 2],
      [18, 20],
    ],
  ],
  [
    'outer',
    [
      [0, -2],
      [22, -2],
      [22, 20],
    ],
  ],
] as const)(
  'updates %s alignment through history and document reload',
  async (alignment, expected) => {
    const [api] = world.apis;
    await world.reset(api, [
      polyline({ strokes: [{ type: 'solid', value: 'red' }], strokeWidth: 4 }),
    ]);
    await world.frame();
    const original = state(api);
    await world.edit(api, (editor) =>
      editor.updateNode(editor.getNodeById('line'), {
        strokeAlignment: alignment,
      }),
    );
    await world.frame();
    expect(state(api).points).toEqual(expected);
    await reloadMatches(api);
    await world.history(api, 'undo');
    await world.frame();
    expect(state(api)).toEqual(original);
    await world.history(api, 'redo');
    await world.frame();
    expect(state(api).points).toEqual(expected);
  },
);

it.each([
  { strokes: undefined },
  { strokes: [] },
] as Partial<PolylineSerializedNode>[])(
  'loads absent/empty strokes %j without creating paint or shifting points',
  async ({ strokes }) => {
    const [api] = world.apis;
    await world.reset(api, [polyline({ strokes })]);
    await world.frame();
    expect(state(api)).toEqual({ points: source, geometry: [0, 0, 20, 20] });
    await reloadMatches(api);
  },
);

it('adds, removes, and restores stroke geometry without changing source points', async () => {
  const [api] = world.apis;
  await world.reset(api, [polyline()]);
  await world.frame();
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('line'), {
      strokes: [{ type: 'solid', value: 'blue' }],
      strokeWidth: 4,
      strokeAlignment: 'outer',
    }),
  );
  await world.frame();
  const painted = state(api);
  expect(painted.points).toEqual([
    [0, -2],
    [22, -2],
    [22, 20],
  ]);
  await reloadMatches(api);
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('line'), {
      strokes: [],
      strokeWidth: undefined,
      strokeAlignment: undefined,
    }),
  );
  await world.frame();
  expect(state(api).points).toEqual(source);
  await reloadMatches(api);
  await world.history(api, 'undo');
  await world.frame();
  expect(state(api)).toEqual(painted);
  await world.history(api, 'redo');
  await world.frame();
  expect(state(api).points).toEqual(source);
  expect(api.getEntity(api.getNodeById('line')).read(Polyline).points).toEqual(
    source,
  );
});

it('refreshes an edited polyline and ignores a deleted stroked entity', async () => {
  const [api] = world.apis;
  await world.reset(api, [
    polyline({
      strokes: [{ type: 'solid', value: 'red' }],
      strokeWidth: 4,
      strokeAlignment: 'inner',
    }),
  ]);
  await world.frame();
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('line'), {
      points: '0,0 40,0 40,10',
      width: 40,
      height: 10,
    }),
  );
  await world.frame();
  expect(state(api).points).toEqual([
    [0, 2],
    [38, 2],
    [38, 10],
  ]);
  await reloadMatches(api);
  await world.reset(api, []);
  await world.frame();
  expect(api.getNodes()).toEqual([]);
});

it('refreshes every subpath after a path edit', async () => {
  const [api] = world.apis;
  const path: SerializedNode = {
    id: 'path',
    type: 'path',
    zIndex: 0,
    x: 0,
    y: 0,
    width: 30,
    height: 30,
    d: 'M0 0 L10 0 M20 20 L30 30',
  };
  await world.reset(api, [path]);
  await world.frame();
  const points = () =>
    api.getEntity(api.getNodeById('path')).read(ComputedPoints).points;
  expect(points()).toEqual([
    [
      [0, 0],
      [10, 0],
    ],
    [
      [20, 20],
      [30, 30],
    ],
  ]);
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('path'), { d: 'M5 5 L15 5' }),
  );
  await world.frame();
  expect(points()).toEqual([
    [
      [5, 5],
      [15, 5],
    ],
  ]);
  await world.history(api, 'undo');
  await world.frame();
  expect(points()).toEqual([
    [
      [0, 0],
      [10, 0],
    ],
    [
      [20, 20],
      [30, 30],
    ],
  ]);
});

it.each([
  ['empty', [], []],
  ['one sample', [[3, 4]], [[3, 4]]],
  [
    'coincident',
    [
      [3, 4],
      [3, 4],
      [3, 4],
    ],
    [
      [3, 4],
      [3, 4],
      [3, 4],
    ],
  ],
  [
    'horizontal',
    [
      [0, 0],
      [10, 0],
    ],
    [
      [0, 2],
      [10, 2],
    ],
  ],
  [
    'vertical',
    [
      [0, 0],
      [0, 10],
    ],
    [
      [-2, 0],
      [-2, 10],
    ],
  ],
  [
    'collinear',
    [
      [0, 0],
      [10, 0],
      [20, 0],
    ],
    [
      [0, 2],
      [10, 2],
      [20, 2],
    ],
  ],
  [
    'right turn',
    [
      [0, 0],
      [20, 0],
      [20, 20],
    ],
    [
      [0, 2],
      [18, 2],
      [18, 20],
    ],
  ],
  [
    'left turn',
    [
      [0, 0],
      [20, 0],
      [20, -20],
    ],
    [
      [0, 2],
      [22, 2],
      [22, -20],
    ],
  ],
  [
    'repeated endpoints',
    [
      [0, 0],
      [0, 0],
      [20, 0],
      [20, 0],
    ],
    [
      [0, 2],
      [0, 2],
      [20, 2],
      [20, 2],
    ],
  ],
  [
    'repeated corner',
    [
      [0, 0],
      [20, 0],
      [20, 0],
      [20, 20],
    ],
    [
      [0, 2],
      [18, 2],
      [18, 2],
      [18, 20],
    ],
  ],
  [
    'reversal',
    [
      [0, 0],
      [20, 0],
      [0, 0],
    ],
    [
      [0, 2],
      [20, 2],
      [0, -2],
    ],
  ],
] as [string, [number, number][], [number, number][]][])(
  'offsets %s without mutating samples',
  (_name, input, expected) => {
    const original = structuredClone(input);
    expect(shiftPoints(input, true, 4)).toEqual(expected);
    expect(input).toEqual(original);
    const outer = shiftPoints(input, false, 4);
    outer.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(2 * input[i][0] - expected[i][0]);
      expect(y).toBeCloseTo(2 * input[i][1] - expected[i][1]);
    });
    expect(maybeShiftPoints(input, 'center', 4)).toEqual(input);
    expect(maybeShiftPoints(input, 'inner', 0)).toEqual(input);
  },
);

it('updates ancestor bounds when an aligned stroke changes', async () => {
  const [api] = world.apis;
  await world.reset(api, [
    { id: 'group', type: 'g', zIndex: 0, x: 40, y: 30 },
    polyline({
      parentId: 'group',
      strokes: [{ type: 'solid', value: 'red' }],
      strokeWidth: 4,
      strokeAlignment: 'inner',
    }),
  ]);
  await world.frame();
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('line'), {
      strokeAlignment: 'outer',
      strokeWidth: 8,
    }),
  );
  await world.frame();
  const groupBounds = api
    .getEntity(api.getNodeById('group'))
    .read(ComputedBounds).geometryWorldBounds;
  expect([
    groupBounds.minX,
    groupBounds.minY,
    groupBounds.maxX,
    groupBounds.maxY,
  ]).toEqual([40, 26, 64, 50]);
  await reloadMatches(api);
});

it('leaves cached points alone on idle frames and unrelated edits', async () => {
  const [api] = world.apis;
  await world.reset(api, [
    polyline({
      strokes: [{ type: 'solid', value: 'red' }],
      strokeWidth: 4,
      strokeAlignment: 'inner',
    }),
  ]);
  await world.frame();
  const points = () =>
    api.getEntity(api.getNodeById('line')).read(ComputedPoints).shiftedPoints;
  const cached = points();
  await world.frame();
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('line'), { name: 'Renamed' }),
  );
  await world.frame();
  expect(points()).toBe(cached);
});

it('clears alignment to center and restores it through undo/redo', async () => {
  const [api] = world.apis;
  await world.reset(api, [
    polyline({
      strokes: [{ type: 'solid', value: 'red' }],
      strokeWidth: 4,
      strokeAlignment: 'inner',
    }),
  ]);
  await world.frame();
  const initial = state(api);
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('line'), {
      strokeAlignment: undefined,
    }),
  );
  await world.frame();
  expect(state(api).points).toEqual(source);
  await reloadMatches(api);
  await world.history(api, 'undo');
  await world.frame();
  expect(state(api)).toEqual(initial);
  await world.history(api, 'redo');
  await world.frame();
  expect(state(api).points).toEqual(source);
});
