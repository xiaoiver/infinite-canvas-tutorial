import {
  Canvas,
  Editable,
  GlobalTransform,
  Pen,
  Transformable,
  VectorNetwork,
  VectorNetworkEditMode,
  type API,
  type VectorNetworkSerializedNode,
} from '../../packages/ecs/src';
import {
  pointOnVectorCubic,
  vectorSegmentCubic,
} from '../../packages/ecs/src/utils/vector-network-curve';
import { createSelectionWorld } from '../helpers/ecs-selection';

const seed = (
  patch: Partial<VectorNetworkSerializedNode> = {},
): VectorNetworkSerializedNode => ({
  id: 'vector',
  type: 'vector-network',
  x: 20,
  y: 20,
  width: 140,
  height: 80,
  zIndex: 0,
  isEditing: true,
  fills: [],
  strokes: [{ type: 'solid', value: 'black' }],
  strokeWidth: 2,
  vertices: [
    { x: 0, y: 40 },
    { x: 60, y: 40 },
    { x: 140, y: 40 },
  ],
  segments: [
    { start: 0, end: 1, tangentEnd: { x: -20, y: 0 } },
    { start: 1, end: 2, tangentStart: { x: 30, y: 0 } },
  ],
  regions: [],
  ...patch,
});
let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;
beforeAll(async () => {
  world = await createSelectionWorld();
  [api] = world.apis;
});
beforeEach(async () => {
  await world.pointer(api, 'pointercancel', 190, 190);
  await world.key(api, 'Escape');
  await world.edit(
    api,
    (editor) =>
      editor.setAppState({
        penbarSelected: Pen.SELECT,
        vectorNetworkEditMode: VectorNetworkEditMode.MOVE,
        snapToPixelGridEnabled: false,
        snapToObjectsEnabled: false,
      }),
    'NEVER',
  );
  await world.reset(api, []);
  await world.reset(api, [seed()]);
  await world.edit(
    api,
    (editor) => {
      editor.selectNodes([editor.getNodeById('vector')]);
      editor.updateNode(editor.getNodeById('vector'), { isEditing: true });
    },
    'NEVER',
  );
  await world.frames();
  api.clearHistory();
});
afterAll(async () => {
  await world?.dispose();
});
const node = () => api.getNodeById('vector') as VectorNetworkSerializedNode;
const geometry = () => {
  const {
    x,
    y,
    width,
    height,
    rotation,
    scaleX,
    scaleY,
    vertices,
    segments,
    regions,
  } = node();
  return structuredClone({
    x,
    y,
    width,
    height,
    rotation,
    scaleX,
    scaleY,
    vertices,
    segments,
    regions,
  });
};
const point = (x: number, y: number) => {
  const m = api.getEntity(node()).read(GlobalTransform).matrix;
  return api.canvas2Viewport({
    x: m.m00 * x + m.m10 * y + m.m20,
    y: m.m01 * x + m.m11 * y + m.m21,
  });
};
const vertices = () => node().vertices.map((v) => point(v.x, v.y));
const expectPoint = (
  actual: { x: number; y: number },
  expected: { x: number; y: number },
) => {
  expect(actual.x).toBeCloseTo(expected.x, 3);
  expect(actual.y).toBeCloseTo(expected.y, 3);
};
type Gesture = 'vertex' | 'curve' | 'handle' | 'midpoint';
async function start(kind: Gesture) {
  await world.edit(
    api,
    (editor) =>
      editor.setAppState({
        vectorNetworkEditMode:
          kind === 'curve' || kind === 'handle'
            ? VectorNetworkEditMode.BEND
            : VectorNetworkEditMode.MOVE,
      }),
    'NEVER',
  );
  await world.frames();
  const before = geometry();
  let p: { x: number; y: number };
  if (kind === 'handle') {
    const v = node().vertices[1];
    const anchor = point(v.x, v.y);
    await world.click(api, anchor.x, anchor.y);
    p = point(v.x + 30, v.y);
  } else if (kind === 'vertex') {
    const v = node().vertices[1];
    p = point(v.x, v.y);
  } else {
    const local = pointOnVectorCubic(
      vectorSegmentCubic(node().vertices, node().segments[0])!,
      kind === 'curve' ? 0.25 : 0.5,
    );
    p = point(local[0], local[1]);
  }
  // MouseEvent client coordinates are integer pixels in JSDOM. Round before
  // dispatch so floating camera transforms do not truncate a pixel off the drag.
  p = { x: Math.round(p.x), y: Math.round(p.y) };
  await world.pointer(api, 'pointerdown', p.x, p.y);
  await world.pointer(api, 'pointermove', p.x + 5, p.y - 25);
  expect(geometry()).not.toEqual(before);
  return { p, before };
}
async function trailing(p: { x: number; y: number }) {
  await world.pointer(api, 'pointermove', p.x + 15, p.y - 35);
  await world.pointer(api, 'pointerup', p.x + 15, p.y - 35);
}

it('enters vector editing through two timed clicks and exits on Escape', async () => {
  await world.edit(
    api,
    (editor) => editor.updateNode(node(), { isEditing: false }),
    'NEVER',
  );
  await world.frames();
  const p = point(20, 40);
  await world.doubleClick(api, p.x, p.y);
  expect(node().isEditing).toBe(true);
  expect(api.getEntity(node()).read(Editable).isEditing).toBe(true);
  await world.key(api, 'Escape');
  expect(node().isEditing).toBe(false);
  expect(api.getAppState().layersSelected).toEqual([]);
});

it.each(['vertex', 'curve', 'handle', 'midpoint'] as const)(
  'commits a %s gesture in one reversible step',
  async (kind) => {
    const { p, before } = await start(kind);
    await world.pointer(api, 'pointerup', p.x + 5, p.y - 25);
    const after = geometry();
    expect(api.getEntity(node()).read(VectorNetwork).vertices).toEqual(
      node().vertices,
    );
    if (kind === 'midpoint') expect(node().vertices).toHaveLength(4);
    await world.history(api, 'undo');
    expect(geometry()).toEqual(before);
    expect(api.isUndoStackEmpty()).toBe(true);
    await world.history(api, 'redo');
    expect(geometry()).toEqual(after);
  },
);

for (const kind of ['vertex', 'curve', 'handle', 'midpoint'] as const) {
  it.each(['pointercancel', 'Escape', 'tool', 'mode'] as const)(
    `rolls back ${kind} on %s and ignores the trailing release`,
    async (reason) => {
      const { p, before } = await start(kind);
      if (reason === 'pointercancel')
        await world.pointer(api, 'pointercancel', p.x + 5, p.y - 25);
      else if (reason === 'Escape') await world.key(api, 'Escape');
      else
        await world.edit(
          api,
          (editor) =>
            editor.setAppState(
              reason === 'tool'
                ? { penbarSelected: Pen.HAND }
                : { vectorNetworkEditMode: VectorNetworkEditMode.CUT },
            ),
          'NEVER',
        );
      await world.frames();
      expect(geometry()).toEqual(before);
      await trailing(p);
      expect(geometry()).toEqual(before);
      expect(api.getCanvas().read(Canvas).inputPoints).toHaveLength(0);
      expect(api.isUndoStackEmpty()).toBe(true);
    },
  );

  it.each(['undo', 'redo'] as const)(
    `keeps history authoritative during ${kind}: %s`,
    async (direction) => {
      const original = geometry();
      await world.edit(api, (editor) =>
        editor.updateNode(node(), {
          vertices: node().vertices.map((v, i) =>
            i === 1 ? { ...v, y: 30 } : v,
          ),
        }),
      );
      const committed = geometry();
      if (direction === 'redo') await world.history(api, 'undo');
      await world.frames();
      const { p } = await start(kind);
      await world.history(api, direction);
      await world.frames();
      expect(geometry()).toEqual(direction === 'undo' ? original : committed);
      await trailing(p);
      expect(geometry()).toEqual(direction === 'undo' ? original : committed);
      await world.history(api, direction === 'undo' ? 'redo' : 'undo');
      expect(geometry()).toEqual(direction === 'undo' ? committed : original);
    },
  );

  it(`preserves external geometry over a stale ${kind} gesture`, async () => {
    const { p } = await start(kind);
    await world.edit(
      api,
      (editor) =>
        editor.updateNode(node(), {
          vertices: node().vertices.map((v, i) =>
            i === 0 ? { ...v, x: v.x + 12 } : v,
          ),
        }),
      'NEVER',
    );
    const external = geometry();
    await trailing(p);
    await world.key(api, 'Escape');
    expect(geometry()).toEqual(external);
  });
}

it.each(['NONE', 'ANGLE', 'ANGLE_AND_LENGTH'] as const)(
  'respects %s handle coupling with fixed anchor positions',
  async (mode) => {
    await world.edit(
      api,
      (editor) =>
        editor.updateNode(node(), {
          vertices: node().vertices.map((v, i) =>
            i === 1 ? { ...v, handleMirroring: mode } : v,
          ),
        }),
      'NEVER',
    );
    const fixed = vertices();
    const { p } = await start('handle');
    await world.pointer(api, 'pointerup', p.x + 5, p.y - 25);
    vertices().forEach((v, i) => expectPoint(v, fixed[i]));
    const a = node().segments[1].tangentStart!;
    const b = node().segments[0].tangentEnd!;
    expectPoint(a, { x: 35, y: -25 });
    if (mode === 'NONE') expectPoint(b, { x: -20, y: 0 });
    else {
      expect(a.x * b.y - a.y * b.x).toBeCloseTo(0, 3);
      expect(Math.hypot(b.x, b.y)).toBeCloseTo(
        mode === 'ANGLE' ? 20 : Math.hypot(a.x, a.y),
        3,
      );
    }
  },
);

it('moves a vertex under rotation and reflection without moving its neighbors', async () => {
  await world.edit(
    api,
    (editor) =>
      editor.updateNode(node(), {
        x: 170,
        y: 100,
        rotation: 0.3,
        scaleX: -1,
        scaleY: 0.6,
      }),
    'NEVER',
  );
  await world.frames();
  const fixed = vertices();
  const { p } = await start('vertex');
  await world.pointer(api, 'pointerup', p.x + 5, p.y - 25);
  const moved = vertices();
  expectPoint(moved[0], fixed[0]);
  expectPoint(moved[2], fixed[2]);
  expectPoint(moved[1], { x: fixed[1].x + 5, y: fixed[1].y - 25 });
  expect(api.getCamera().read(Transformable).selectedControlPointIndex).toBe(1);
});

it('preserves an external style edit while rolling back an unfinished vertex move', async () => {
  const { p, before } = await start('vertex');
  await world.edit(
    api,
    (editor) =>
      editor.updateNode(node(), {
        strokes: [{ type: 'solid', value: 'blue' }],
      }),
    'NEVER',
  );
  await world.pointer(api, 'pointercancel', p.x + 5, p.y - 25);
  await trailing(p);
  expect(geometry()).toEqual(before);
  expect(node().strokes).toEqual([{ type: 'solid', value: 'blue' }]);
});

it('does not recreate a document node deleted during a drag', async () => {
  const { p } = await start('vertex');
  await world.edit(
    api,
    (editor) => editor.deleteNodesById(['vector']),
    'NEVER',
  );
  await trailing(p);
  await world.key(api, 'Escape');
  expect(api.getNodes()).toEqual([]);
});

it.each([false, true])(
  'deletes a selected vertex, heal=%s, with one undo step',
  async (heal) => {
    await world.edit(
      api,
      (editor) =>
        editor.updateNode(node(), {
          segments: [
            { start: 0, end: 1 },
            { start: 1, end: 2 },
          ],
        }),
      'NEVER',
    );
    const before = geometry();
    const v = point(60, 40);
    await world.click(api, Math.round(v.x), Math.round(v.y));
    expect(api.getCamera().read(Transformable).selectedControlPointIndex).toBe(
      1,
    );
    await world.key(api, 'Delete', { shiftKey: !heal });
    expect(node().vertices).toHaveLength(2);
    expect(node().segments).toHaveLength(heal ? 1 : 0);
    await world.history(api, 'undo');
    expect(geometry()).toEqual(before);
  },
);

it('cuts a shared vertex into separate endpoints and restores the topology on undo', async () => {
  const before = geometry();
  await world.edit(
    api,
    (editor) =>
      editor.setAppState({ vectorNetworkEditMode: VectorNetworkEditMode.CUT }),
    'NEVER',
  );
  const p = point(60, 40);
  await world.click(api, Math.round(p.x), Math.round(p.y));
  expect(node().vertices).toHaveLength(4);
  expect(node().segments[0].end).not.toBe(node().segments[1].start);
  expect(api.getAppState().vectorNetworkEditMode).toBe(
    VectorNetworkEditMode.MOVE,
  );
  await world.history(api, 'undo');
  expect(geometry()).toEqual(before);
});
