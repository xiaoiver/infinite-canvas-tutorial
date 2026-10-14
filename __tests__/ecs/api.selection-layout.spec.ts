import {
  API,
  ComputedBounds,
  type NodeAlignment,
  type RectSerializedNode,
  type SerializedNode,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';

const rect = (
  id: string,
  patch: Partial<RectSerializedNode> = {},
): RectSerializedNode => ({
  id,
  type: 'rect',
  x: 10,
  y: 20,
  width: 20,
  height: 10,
  zIndex: 0,
  fills: [{ type: 'solid', value: 'red' }],
  ...patch,
});
let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
beforeAll(async () => {
  world = await createDocumentWorld(2);
  [api] = world.apis;
});
afterAll(async () => {
  await world?.dispose();
});
const geometry = (id: string, editor = api) => {
  const g = editor
    .getEntity(editor.getNodeById(id))
    .read(ComputedBounds).geometryWorldBounds;
  return { minX: g.minX, minY: g.minY, maxX: g.maxX, maxY: g.maxY };
};
const pose = (id: string, editor = api) => {
  const n = editor.getNodeById(id);
  return {
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    rotation: n.rotation,
    scaleX: n.scaleX,
    scaleY: n.scaleY,
  };
};
async function scene(
  nodes: SerializedNode[],
  selected = nodes.map((n) => n.id),
  editor = api,
) {
  await world.reset(editor, nodes);
  await world.edit(
    editor,
    (a) => a.setAppState({ layersSelected: selected }),
    'NEVER',
  );
  await world.frame();
  editor.clearHistory();
}
async function edit(fn: (editor: API) => void) {
  await world.edit(api, fn);
  await world.frame();
}
const basic = () => [
  rect('a'),
  rect('b', { x: 80, y: 60, width: 40, height: 30 }),
  rect('c', { x: 45, y: 100, width: 10, height: 20 }),
];

it.each([
  ['left', [10, 10, 10], [20, 60, 100]],
  ['right', [100, 80, 110], [20, 60, 100]],
  ['centerH', [55, 45, 60], [20, 60, 100]],
  ['top', [10, 80, 45], [20, 20, 20]],
  ['bottom', [10, 80, 45], [110, 90, 100]],
  ['centerV', [10, 80, 45], [65, 55, 60]],
] as [NodeAlignment, number[], number[]][])(
  'aligns %s in world geometry and commits one reversible edit',
  async (alignment, xs, ys) => {
    await scene(basic());
    const before = ['a', 'b', 'c'].map((id) => pose(id));
    await edit((a) => a.alignSelectedNodes(alignment));
    const after = ['a', 'b', 'c'].map((id) => pose(id));
    after.forEach((p, i) => {
      expect(p.x).toBeCloseTo(xs[i]);
      expect(p.y).toBeCloseTo(ys[i]);
      expect(p.width).toBe(before[i].width);
      expect(p.height).toBe(before[i].height);
    });
    await world.history(api, 'undo');
    expect(['a', 'b', 'c'].map((id) => pose(id))).toEqual(before);
    expect(api.isUndoStackEmpty()).toBe(true);
    await world.history(api, 'redo');
    expect(['a', 'b', 'c'].map((id) => pose(id))).toEqual(after);
  },
);

it.each([
  [2, 0.5, 0],
  [-2, 0.5, 0.6],
  [1.5, -3, -0.4],
  [-1, -1, 1.1],
])(
  'preserves scale and shape while translating %j',
  async (scaleX, scaleY, rotation) => {
    await scene([
      rect('a', { x: 70, scaleX, scaleY, rotation }),
      rect('b', { x: 200, width: 40 }),
    ]);
    const before = pose('a'),
      bounds = geometry('a');
    const target = geometry('b').maxX;
    await edit((a) => a.alignSelectedNodes('right'));
    const after = pose('a'),
      actual = geometry('a');
    expect(actual.maxX).toBeCloseTo(target, 3);
    expect(actual.maxX - actual.minX).toBeCloseTo(bounds.maxX - bounds.minX, 3);
    expect(actual.maxY - actual.minY).toBeCloseTo(bounds.maxY - bounds.minY, 3);
    for (const key of [
      'width',
      'height',
      'rotation',
      'scaleX',
      'scaleY',
    ] as const)
      expect(after[key]).toBe(before[key]);
  },
);

it.each(['horizontal', 'vertical'] as const)(
  'distributes unequal sizes %s with equal gaps and fixed outer bounds',
  async (axis) => {
    const horizontal = axis === 'horizontal';
    await scene(
      [
        rect('a', { x: 10, y: 10, width: 10, height: 10 }),
        rect('b', { x: 90, y: 90, width: 20, height: 20 }),
        rect('c', { x: 150, y: 150, width: 30, height: 30 }),
      ],
      ['c', 'a', 'b'],
    );
    const before = ['a', 'b', 'c'].map((id) => pose(id));
    await edit((a) => a.distributeSelectedNodesSpacing(axis));
    const after = ['a', 'b', 'c'].map((id) => pose(id));
    expect(after.map((p) => (horizontal ? p.x : p.y))).toEqual([10, 75, 150]);
    expect(after.map((p) => (horizontal ? p.y : p.x))).toEqual([10, 90, 150]);
    await world.history(api, 'undo');
    expect(['a', 'b', 'c'].map((id) => pose(id))).toEqual(before);
    expect(api.isUndoStackEmpty()).toBe(true);
    await world.history(api, 'redo');
    expect(['a', 'b', 'c'].map((id) => pose(id))).toEqual(after);
  },
);

it('deduplicates explicit IDs before calculating spacing', async () => {
  await scene(
    [
      rect('a', { x: 0, width: 10 }),
      rect('b', { x: 25, width: 10 }),
      rect('c', { x: 100, width: 10 }),
    ],
    [],
  );
  await edit((a) =>
    a.distributeSelectedNodesSpacing('horizontal', ['a', 'b', 'b', 'c']),
  );
  expect(api.getNodeById('b').x).toBe(50);
  expect(api.getAppState().layersSelected).toEqual([]);
});

it('does not translate a selected descendant a second time with its group', async () => {
  await scene(
    [
      { id: 'group', type: 'g', x: 40, y: 20, zIndex: 0 },
      rect('child', { parentId: 'group', x: 10, y: 5 }),
      rect('target', { x: 200, width: 40 }),
    ],
    ['group', 'child', 'target'],
  );
  const before = pose('child');
  await edit((a) => a.alignSelectedNodes('right'));
  expect(pose('child')).toEqual(before);
  expect(geometry('group').maxX).toBeCloseTo(geometry('target').maxX, 3);
});

it('preserves positions and geometry under a rotated, scaled parent', async () => {
  await scene(
    [
      rect('parent', {
        x: 30,
        y: 40,
        width: 100,
        height: 100,
        rotation: 0.7,
        scaleX: 2,
        scaleY: 0.5,
      }),
      rect('child', {
        parentId: 'parent',
        x: 10,
        y: 15,
        scaleX: -1.5,
        rotation: 0.3,
      }),
      rect('target', { x: 250, width: 40 }),
    ],
    ['child', 'target'],
  );
  const before = geometry('child'),
    original = pose('child');
  await edit((a) => a.alignSelectedNodes('right'));
  const after = geometry('child');
  expect(after.maxX).toBeCloseTo(geometry('target').maxX, 3);
  expect(after.maxX - after.minX).toBeCloseTo(before.maxX - before.minX, 3);
  expect(after.maxY - after.minY).toBeCloseTo(before.maxY - before.minY, 3);
  expect(pose('child').rotation).toBe(original.rotation);
  expect(pose('child').scaleX).toBe(original.scaleX);
});

it.each(['horizontal', 'vertical'] as const)(
  'keeps equal negative %s gaps for overlapping shapes',
  async (axis) => {
    await scene([
      rect('a', { x: 0, y: 0, width: 60, height: 60 }),
      rect('b', { x: 30, y: 30, width: 30, height: 30 }),
      rect('c', { x: 50, y: 50, width: 20, height: 20 }),
    ]);
    await edit((a) => a.distributeSelectedNodesSpacing(axis));
    expect(
      ['a', 'b', 'c'].map(
        (id) => api.getNodeById(id)[axis === 'horizontal' ? 'x' : 'y'],
      ),
    ).toEqual([0, 40, 50]);
  },
);

it.each(['horizontal', 'vertical'] as const)(
  'uses the entire %s envelope when an earlier shape extends beyond the last',
  async (axis) => {
    await scene([
      rect('a', { x: 0, y: 0, width: 200, height: 200 }),
      rect('b', { x: 60, y: 60, width: 10, height: 10 }),
      rect('c', { x: 90, y: 90, width: 10, height: 10 }),
    ]);
    await edit((a) => a.distributeSelectedNodesSpacing(axis));
    expect(
      ['a', 'b', 'c'].map(
        (id) => api.getNodeById(id)[axis === 'horizontal' ? 'x' : 'y'],
      ),
    ).toEqual([0, 190, 190]);
  },
);

it.each([
  { type: 'ellipse', width: 30, height: 20 },
  { type: 'line', x1: 0, y1: 0, x2: 40, y2: 20 },
  {
    type: 'polyline',
    points: '0,0 10,20 40,10',
    strokeWidth: 2,
    strokes: [{ type: 'solid', value: 'black' }],
  },
  { type: 'path', d: 'M0 0 Q20 40 50 10' },
  { type: 'text', content: 'Move me', fontFamily: 'sans-serif', fontSize: 20 },
  {
    type: 'text',
    content: 'Curved',
    fontFamily: 'sans-serif',
    fontSize: 20,
    path: 'M0 0 Q50 -20 100 0',
  },
  {
    type: 'rect',
    width: 40,
    height: 20,
    display: 'flex',
    flexHugWidth: true,
    flexHugHeight: true,
  },
] as Partial<SerializedNode>[])(
  'only changes position when aligning a $type shape',
  async (patch) => {
    const shape = {
      id: 'shape',
      zIndex: 0,
      x: 60,
      y: 70,
      rotation: 0.35,
      scaleX: -1.5,
      scaleY: 0.75,
      ...patch,
    } as SerializedNode;
    await scene([shape, rect('target', { x: 250, y: 160 })]);
    const geometryBefore = geometry('shape');
    const original = structuredClone(api.getNodeById('shape'));
    await edit((a) => a.alignSelectedNodes('right'));
    const updated = api.getNodeById('shape');
    for (const key of Object.keys(original)) {
      if (!['x', 'y', 'version', 'versionNonce', 'updated'].includes(key))
        expect(updated[key]).toEqual(original[key]);
    }
    const bounds = geometry('shape');
    expect(bounds.maxX - bounds.minX).toBeCloseTo(
      geometryBefore.maxX - geometryBefore.minX,
      3,
    );
    expect(bounds.maxY - bounds.minY).toBeCloseTo(
      geometryBefore.maxY - geometryBefore.minY,
      3,
    );
  },
);

it('ignores thick strokes when aligning geometry', async () => {
  await scene([
    rect('a', {
      x: 60,
      strokeWidth: 40,
      strokes: [{ type: 'solid', value: 'blue' }],
    }),
    rect('b', {
      x: 150,
      strokeWidth: 2,
      strokes: [{ type: 'solid', value: 'blue' }],
    }),
  ]);
  await edit((a) => a.alignSelectedNodes('left'));
  expect(api.getNodeById('b').x).toBe(60);
});

it.each(['align', 'distribute'] as const)(
  'ignores locked, missing and deleted nodes for %s',
  async (operation) => {
    await scene(
      [
        rect('a', { x: 10 }),
        rect('b', { x: 90 }),
        rect('c', { x: 150 }),
        rect('locked', { x: -100, locked: true }),
        rect('deleted', { x: 1000, isDeleted: true }),
      ],
      ['a', 'b', 'c', 'locked', 'deleted', 'missing'],
    );
    const locked = pose('locked');
    await edit((a) =>
      operation === 'align'
        ? a.alignSelectedNodes('left')
        : a.distributeSelectedNodesSpacing('horizontal'),
    );
    expect(pose('locked')).toEqual(locked);
    expect(api.getNodeById('b').x).toBe(operation === 'align' ? 10 : 80);
    expect(api.getNodeById('deleted')).toBeUndefined();
    expect(api.getNodeById('missing')).toBeUndefined();
  },
);

it.each(
  (
    [[], ['a'], ['a', 'a'], ['a', 'locked'], ['a', 'missing']] as string[][]
  ).map((ids) => [ids]),
)('does not record an insufficient selection %j', async (ids) => {
  await scene([rect('a'), rect('locked', { locked: true })], ids);
  let aligned: boolean, distributed: boolean;
  await world.edit(
    api,
    (a) => {
      aligned = a.alignSelectedNodes('left');
      distributed = a.distributeSelectedNodesSpacing('vertical');
    },
    'NEVER',
  );
  expect(aligned!).toBe(false);
  expect(distributed!).toBe(false);
  expect(api.isUndoStackEmpty()).toBe(true);
});

it('is idempotent and does not add history for an already aligned selection', async () => {
  await scene([rect('a'), rect('b', { x: 100 })]);
  await edit((a) => a.alignSelectedNodes('left'));
  const after = ['a', 'b'].map((id) => pose(id));
  await edit((a) => {
    expect(a.alignSelectedNodes('left')).toBe(false);
    expect(a.distributeSelectedNodesSpacing('horizontal')).toBe(false);
  });
  expect(['a', 'b'].map((id) => pose(id))).toEqual(after);
  await world.history(api, 'undo');
  expect(api.getNodeById('b').x).toBe(100);
  expect(api.isUndoStackEmpty()).toBe(true);
});

it('uses live geometry for queued edits and allows cancellation before mutation', async () => {
  await scene(basic());
  const controller = new AbortController();
  const cancelled = api.edit((a) => a.alignSelectedNodes('left'), {
    signal: controller.signal,
  });
  controller.abort();
  expect(await cancelled).toBe(false);
  await world.frame();
  expect(api.getNodeById('b').x).toBe(80);
  expect(api.isUndoStackEmpty()).toBe(true);
  await edit((a) => a.updateNode(a.getNodeById('a'), { x: 30 }));
  await edit((a) => a.alignSelectedNodes('left'));
  expect(api.getNodeById('b').x).toBe(30);
  await world.history(api, 'undo');
  expect(api.getNodeById('a').x).toBe(30);
  expect(api.getNodeById('b').x).toBe(80);
  await world.history(api, 'undo');
  expect(api.getNodeById('a').x).toBe(10);
});

it('keeps identical IDs and history isolated across two canvases', async () => {
  const right = world.apis[1];
  await scene(basic());
  await scene(
    [rect('a', { x: 300 }), rect('b', { x: 400 }), rect('c', { x: 600 })],
    undefined,
    right,
  );
  const other = right.getNodes().map((n) => pose(n.id, right));
  await edit((a) => a.alignSelectedNodes('right'));
  expect(right.getNodes().map((n) => pose(n.id, right))).toEqual(other);
  expect(right.isUndoStackEmpty()).toBe(true);
  await world.history(api, 'undo');
  expect(right.getNodes().map((n) => pose(n.id, right))).toEqual(other);
});

it('skips a singular parent transform without corrupting other nodes', async () => {
  await scene(
    [
      rect('parent', { scaleX: 0 }),
      rect('child', { parentId: 'parent', x: 5 }),
      rect('a', { x: 50 }),
      rect('b', { x: 100 }),
    ],
    ['child', 'a', 'b'],
  );
  const before = pose('child');
  await edit((a) => a.alignSelectedNodes('left'));
  expect(pose('child')).toEqual(before);
  expect(api.getNodeById('b').x).toBe(50);
});
