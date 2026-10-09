import {
  Canvas,
  GlobalTransform,
  ComputedCamera,
  Pen,
  Transformable,
  TransformableStatus,
  type API,
  type RectSerializedNode,
  type SerializedNode,
} from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';

const rect = (
  id: string,
  x: number,
  y: number,
  width = 40,
  height = 40,
): RectSerializedNode => ({
  id,
  type: 'rect',
  x,
  y,
  width,
  height,
  zIndex: 0,
  fills: [{ type: 'solid', value: 'red' }],
});
let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;
beforeAll(async () => {
  world = await createSelectionWorld(2);
  [api] = world.apis;
  for (const editor of world.apis) {
    await world.edit(editor, () => editor.resizeCanvas(600, 400), 'NEVER');
  }
});
afterAll(async () => {
  await world?.dispose();
});
beforeEach(async () => {
  for (const editor of world.apis) {
    await world.pointer(editor, 'pointercancel', 590, 390);
    await world.key(editor, 'Escape');
    await world.key(editor, 'Alt');
    await world.key(editor, 'Shift');
    await world.edit(
      editor,
      () => {
        editor.gotoLandmark(
          { x: 0, y: 0, zoom: 1, rotation: 0 },
          { duration: 0 },
        );
        editor.setAppState({
          penbarSelected: Pen.SELECT,
          snapToObjectsEnabled: true,
          snapToObjectsDistance: 8,
          snapToPixelGridEnabled: false,
          snapToPixelGridSize: 10,
          flipEnabled: true,
        });
      },
      'NEVER',
    );
    await world.reset(editor, []);
  }
});
const node = (id = 'shape', editor = api) => editor.getNodeById(id);
const tf = () => api.getCamera().read(Transformable);
const geometry = (id = 'shape') => {
  const n = node(id);
  return {
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    rotation: n.rotation ?? 0,
    scaleX: n.scaleX ?? 1,
    scaleY: n.scaleY ?? 1,
  };
};
const expectGeometry = (expected: Record<string, number>, id = 'shape') => {
  const actual = geometry(id);
  for (const [key, value] of Object.entries(expected))
    expect(actual[key]).toBeCloseTo(value, 3);
};
const worldPoint = (id: string, x = 0, y = 0) => {
  const m = api.getEntity(node(id)).read(GlobalTransform).matrix;
  return { x: m.m00 * x + m.m10 * y + m.m20, y: m.m01 * x + m.m11 * y + m.m21 };
};
const expectPoint = (
  actual: { x: number; y: number },
  expected: { x: number; y: number },
) => {
  expect(actual.x).toBeCloseTo(expected.x, 3);
  expect(actual.y).toBeCloseTo(expected.y, 3);
};
const pointer = async (
  type: string,
  x: number,
  y: number,
  options: Parameters<typeof world.pointer>[4] = {},
) => {
  const p = api.canvas2Viewport({ x, y });
  await world.pointer(api, type, p.x, p.y, options);
};
async function scene(
  nodes: SerializedNode[] = [
    rect('shape', 40, 100),
    rect('reference', 100, 20),
  ],
  ids = ['shape'],
) {
  await world.reset(api, nodes);
  await world.edit(
    api,
    () => api.selectNodes(ids.map((id) => node(id))),
    'NEVER',
  );
  await world.frames();
  api.clearHistory();
}
async function history(
  before: ReturnType<typeof geometry>,
  after: ReturnType<typeof geometry>,
) {
  await world.history(api, 'undo');
  await world.frames();
  expectGeometry(before);
  expect(api.isUndoStackEmpty()).toBe(true);
  await world.history(api, 'redo');
  await world.frames();
  expectGeometry(after);
}

it.each(['mouse', 'touch', 'pen'] as const)(
  'snaps and escapes through small %s moves without accumulating corrections',
  async (pointerType) => {
    await scene();
    const before = geometry();
    const options = { pointerType };
    // Touch has wider edge hit targets and no draggable center pivot.
    const sx = pointerType === 'touch' ? 60 : 52;
    const sy = pointerType === 'touch' ? 120 : 118;
    await pointer('pointerdown', sx, sy, options);
    await pointer('pointermove', sx + 15, sy, options);
    expectGeometry({ x: 60, y: 100 });
    expect(tf().status).toBe(TransformableStatus.MOVING);
    for (let dx = 16; dx <= 31; dx++)
      await pointer('pointermove', sx + dx, sy, options);
    expectGeometry({ x: 71, y: 100 });
    await pointer('pointerup', sx + 31, sy, options);
    await history(before, geometry());
  },
);

it.each([0.5, 1, 2])(
  'keeps the attraction radius in CSS pixels at zoom %s',
  async (zoom) => {
    await scene([rect('shape', 20, 40, 80, 80), rect('reference', 140, 0)]);
    await world.edit(
      api,
      () =>
        api.gotoLandmark({ x: 0, y: 0, zoom, rotation: 0 }, { duration: 0 }),
      'NEVER',
    );
    await world.frames();
    await pointer('pointerdown', 45, 80);
    await pointer('pointermove', 85 - 6 / zoom, 80);
    expectGeometry({ x: 60 });
    await pointer('pointermove', 85 + 10 / zoom, 80);
    expectGeometry({ x: 60 + 10 / zoom });
    await pointer('pointerup', 85 + 10 / zoom, 80);
  },
);

it('combines pixel-grid and off-grid object snapping without feeding back prior corrections', async () => {
  await scene([rect('shape', 40, 100), rect('reference', 103, 20)]);
  await world.edit(
    api,
    () => api.setAppState({ snapToPixelGridEnabled: true }),
    'NEVER',
  );
  const before = geometry();
  await pointer('pointerdown', 52, 118);
  for (let dx = 1; dx <= 24; dx++) {
    await pointer('pointermove', 52 + dx, 118);
    if (dx >= 15) expectGeometry({ x: 63 });
  }
  await pointer('pointermove', 172, 118);
  await pointer('pointerup', 172, 118);
  expectGeometry({ x: 160 });
  await history(before, geometry());
});

it('drops object corrections immediately when snapping is disabled during a drag', async () => {
  await scene();
  await pointer('pointerdown', 52, 118);
  await pointer('pointermove', 67, 118);
  expectGeometry({ x: 60 });
  await world.edit(
    api,
    () => api.setAppState({ snapToObjectsEnabled: false }),
    'NEVER',
  );
  await pointer('pointermove', 68, 118);
  expectGeometry({ x: 56 });
  await pointer('pointerup', 68, 118);
});

it.each(['hidden', 'culled', 'other canvas'] as const)(
  'ignores references on %s nodes',
  async (kind) => {
    const reference = rect('reference', 100, kind === 'culled' ? 800 : 20);
    if (kind === 'hidden') reference.visibility = 'hidden';
    await scene(
      kind === 'other canvas'
        ? [rect('shape', 40, 100)]
        : [rect('shape', 40, 100), reference],
    );
    if (kind === 'other canvas') await world.reset(world.apis[1], [reference]);
    await pointer('pointerdown', 52, 118);
    await pointer('pointermove', 67, 118);
    expectGeometry({ x: 55 });
    await pointer('pointerup', 67, 118);
  },
);

it.each(['horizontal', 'vertical'] as const)(
  'matches equal %s gaps through the event pipeline',
  async (axis) => {
    const vertical = axis === 'vertical';
    await scene([
      rect('shape', vertical ? 100 : 220, vertical ? 220 : 100),
      rect('a', vertical ? 100 : 20, vertical ? 20 : 100),
      rect('b', 100, 100),
    ]);
    const start = { x: node().x + 12, y: node().y + 18 };
    await pointer('pointerdown', start.x, start.y);
    await pointer(
      'pointermove',
      start.x - (vertical ? 0 : 35),
      start.y - (vertical ? 35 : 0),
    );
    expectGeometry(vertical ? { y: 180 } : { x: 180 });
    await pointer(
      'pointerup',
      start.x - (vertical ? 0 : 35),
      start.y - (vertical ? 35 : 0),
    );
  },
);

it.each(['pointercancel', 'Escape', 'tool'] as const)(
  'ends a snapped move on %s and preserves one history step',
  async (action) => {
    await scene();
    const before = geometry();
    await pointer('pointerdown', 52, 118);
    await pointer('pointermove', 67, 118);
    const after = geometry();
    if (action === 'pointercancel') await pointer('pointercancel', 67, 118);
    else if (action === 'Escape') await world.key(api, 'Escape');
    else api.setAppState({ penbarSelected: Pen.HAND });
    await world.frames();
    expect(api.getCanvas().read(Canvas).inputPoints).toHaveLength(0);
    await pointer('pointermove', 90, 118);
    await pointer('pointerup', 90, 118);
    expectGeometry(after);
    await history(before, after);
  },
);

it.each([
  'edge',
  'corner',
  'Shift',
  'locked ratio',
  'Alt edge',
  'Alt corner',
] as const)(
  'snaps a %s resize while preserving its fixed origin',
  async (mode) => {
    const centered = mode.startsWith('Alt');
    const corner = !mode.endsWith('edge');
    const lock = mode === 'locked ratio' || mode === 'Alt corner';
    const shape = rect('shape', 40, 100);
    if (lock) shape.lockAspectRatio = true;
    await scene([shape, rect('reference', 100, mode === 'corner' ? 160 : 20)]);
    const before = geometry();
    const options = { altKey: centered, shiftKey: mode === 'Shift' };
    await pointer('pointerdown', 80, corner ? 140 : 120, options);
    await pointer('pointermove', 95, corner ? 155 : 120, options);
    expectGeometry(
      centered
        ? { x: 20, y: corner ? 80 : 100, width: 80, height: corner ? 80 : 40 }
        : { x: 40, y: 100, width: 60, height: corner ? 60 : 40 },
    );
    await pointer('pointerup', 95, corner ? 155 : 120, options);
    await history(before, geometry());
  },
);

it.each(['left', 'top'] as const)(
  'snaps only the moving axis of the %s resize handle',
  async (side) => {
    await scene([
      rect('shape', 100, 100, 80, 80),
      rect('reference', side === 'left' ? 40 : 20, side === 'left' ? 20 : 40),
    ]);
    const start = side === 'left' ? [100, 140] : [140, 100];
    const end = side === 'left' ? [85, 137] : [137, 85];
    await pointer('pointerdown', start[0], start[1]);
    await pointer('pointermove', end[0], end[1]);
    expectGeometry(
      side === 'left'
        ? { x: 80, y: 100, width: 100, height: 80 }
        : { x: 100, y: 80, width: 80, height: 100 },
    );
    await pointer('pointerup', end[0], end[1]);
  },
);

it.each([1, -1])(
  'moves a leaf through a rotated parent with scaleX %s in world space',
  async (scaleX) => {
    await scene([
      {
        id: 'group',
        type: 'g',
        x: 160,
        y: scaleX === 1 ? 40 : 200,
        rotation: Math.PI / 2,
        scaleX,
        zIndex: 0,
      },
      { ...rect('shape', 40, 20, 80, 80), parentId: 'group' },
      rect('reference', 160, 0),
    ]);
    const before = geometry();
    const start = worldPoint('shape', 30, 35);
    const origin = worldPoint('shape');
    await pointer('pointerdown', start.x, start.y);
    await pointer('pointermove', start.x + 15, start.y);
    expectPoint(worldPoint('shape'), { x: origin.x + 20, y: origin.y });
    expectGeometry({ x: 40, y: 0 });
    await pointer('pointerup', start.x + 15, start.y);
    await history(before, geometry());
  },
);

it('resizes a nested group without snapping to its own descendants', async () => {
  await scene(
    [
      { id: 'outer', type: 'g', x: 40, y: 100, zIndex: 0 },
      { id: 'inner', type: 'g', parentId: 'outer', x: 0, y: 0, zIndex: 0 },
      { ...rect('shape', 0, 0, 80, 80), parentId: 'inner' },
    ],
    ['outer'],
  );
  const before = geometry();
  const origin = worldPoint('shape');
  await pointer('pointerdown', 120, 180);
  await pointer('pointermove', 125, 185);
  expectGeometry({ width: 85, height: 85 });
  expectPoint(worldPoint('shape'), origin);
  await pointer('pointerup', 125, 185);
  await history(before, geometry());
});

it('snaps a multi-selection resize and restores both nodes in a single undo', async () => {
  await scene(
    [
      rect('shape', 40, 100),
      rect('second', 90, 100),
      rect('reference', 150, 20),
    ],
    ['shape', 'second'],
  );
  const before = [geometry(), geometry('second')];
  await pointer('pointerdown', 130, 140);
  await pointer('pointermove', 145, 140);
  expect(node('second').x + node('second').width).toBeCloseTo(150, 3);
  expectGeometry({ x: 40 });
  await pointer('pointerup', 145, 140);
  const after = [geometry(), geometry('second')];
  await history(before[0], after[0]);
  expectGeometry(after[1], 'second');
  await world.history(api, 'undo');
  expectGeometry(before[1], 'second');
});

it.each([1, -1])(
  'rotates a leaf under a rotated parent with scaleX %s around its world center',
  async (scaleX) => {
    await scene([
      {
        id: 'outer',
        type: 'g',
        x: 220,
        y: 100,
        rotation: Math.PI / 6,
        scaleX,
        zIndex: 0,
      },
      {
        id: 'inner',
        type: 'g',
        parentId: 'outer',
        x: 10,
        y: 15,
        rotation: Math.PI / 6,
        zIndex: 0,
      },
      { ...rect('shape', 30, 30, 60, 40), parentId: 'inner' },
    ]);
    const before = geometry();
    const center = worldPoint('shape', 30, 20);
    const corners = [
      [0, 0],
      [60, 0],
      [60, 40],
      [0, 40],
    ].map(([x, y]) => worldPoint('shape', x, y));
    const start = worldPoint('shape', 70, -10);
    const end = {
      x: center.x - (start.y - center.y),
      y: center.y + (start.x - center.x),
    };
    await pointer('pointerdown', start.x, start.y);
    await pointer('pointermove', end.x, end.y);
    expect(tf().status).toBe(TransformableStatus.ROTATING);
    expectPoint(
      worldPoint('shape', node().width / 2, node().height / 2),
      center,
    );
    const local = [
      [0, 0],
      [node().width, 0],
      [node().width, node().height],
      [0, node().height],
    ];
    local.forEach(([x, y], i) =>
      expectPoint(worldPoint('shape', x, y), {
        x: center.x - (corners[i].y - center.y),
        y: center.y + (corners[i].x - center.x),
      }),
    );
    await pointer('pointerup', end.x, end.y);
    await history(before, geometry());
  },
);

it('snaps a rotated resize edge without drifting its opposite midpoint', async () => {
  await scene([
    { ...rect('shape', 40, 100, 80, 80), rotation: Math.PI / 6 },
    rect('reference', 100, 20),
  ]);
  const before = geometry();
  const opposite = worldPoint('shape', 0, 40);
  const start = worldPoint('shape', 80, 40);
  await pointer('pointerdown', start.x, start.y);
  await pointer('pointermove', start.x + 4, start.y + 2);
  expect(worldPoint('shape', node().width, node().height / 2).x).toBeCloseTo(
    100,
    3,
  );
  expectPoint(worldPoint('shape', 0, node().height / 2), opposite);
  expectGeometry({ rotation: Math.PI / 6 });
  await pointer('pointerup', start.x + 4, start.y + 2);
  await history(before, geometry());
});

it.each([{ zoom: 2 }, { x: 75 }, { rotation: Math.PI / 2 }, {}])(
  'preserves omitted camera properties when navigating to %j',
  async (patch) => {
    await scene();
    const original = { x: 30, y: 50, zoom: 1.5, rotation: Math.PI / 6 };
    await world.edit(
      api,
      () => api.gotoLandmark(original, { duration: 0 }),
      'NEVER',
    );
    await world.frames();
    await world.edit(
      api,
      () => api.gotoLandmark(patch, { duration: 0 }),
      'NEVER',
    );
    await world.frames();
    const camera = api.getCamera().read(ComputedCamera);
    for (const [key, value] of Object.entries({ ...original, ...patch }))
      expect(camera[key]).toBeCloseTo(value, 4);
    const viewport = api.canvas2Viewport({ x: 65, y: 95 });
    expectPoint(api.viewport2Canvas(viewport), { x: 65, y: 95 });
    expect(api.isUndoStackEmpty()).toBe(true);
  },
);

it('keeps the world point beneath a viewport anchor when zoom is the only camera change', async () => {
  await scene();
  await world.edit(
    api,
    () =>
      api.gotoLandmark(
        { x: 30, y: 50, zoom: 1.5, rotation: Math.PI / 6 },
        { duration: 0 },
      ),
    'NEVER',
  );
  await world.frames();
  const anchor = { x: 120.25, y: 80.5 };
  const before = api.viewport2Canvas(anchor);
  await world.edit(
    api,
    () =>
      api.gotoLandmark(
        { zoom: 2, viewportX: anchor.x, viewportY: anchor.y },
        { duration: 0 },
      ),
    'NEVER',
  );
  await world.frames();
  expectPoint(api.viewport2Canvas(anchor), before);
  expect(api.getCamera().read(ComputedCamera).zoom).toBeCloseTo(2);
  expect(api.getCamera().read(ComputedCamera).rotation).toBeCloseTo(
    Math.PI / 6,
  );
});
