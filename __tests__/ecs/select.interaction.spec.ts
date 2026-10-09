import {
  Canvas,
  Selected,
  Transformable,
  TransformableStatus,
  Pen,
  Cursor,
  Highlighted,
  Rect,
  Circle,
  type API,
  type RectSerializedNode,
} from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';

const rect = (
  id = 'a',
  patch: Partial<RectSerializedNode> = {},
): RectSerializedNode => ({
  id,
  type: 'rect',
  x: 30,
  y: 30,
  width: 60,
  height: 40,
  zIndex: 0,
  fills: [{ type: 'solid', value: 'red' }],
  ...patch,
});
let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;
beforeAll(async () => {
  world = await createSelectionWorld(2);
  [api] = world.apis;
});
beforeEach(async () => {
  api.setAppState({ penbarSelected: Pen.SELECT });
  await world.reset(api, [rect()]);
  await world.frames();
});
afterEach(async () => {
  await world.pointer(api, 'pointerup', 190, 190);
  await world.key(api, 'Escape');
  await world.key(api, 'Alt');
});
afterAll(async () => {
  await world?.dispose();
});

const node = () => api.getNodeById('a');
const tf = () => api.getCamera().read(Transformable);
function expectGeometry(expected: Partial<RectSerializedNode>) {
  for (const [key, value] of Object.entries(expected)) {
    expect(node()[key]).toBeCloseTo(value as number, 4);
  }
}
async function select(ids = ['a']) {
  await world.edit(
    api,
    (editor) => editor.selectNodes(ids.map((id) => editor.getNodeById(id))),
    'NEVER',
  );
  await world.frames();
}

it.each(['mouse', 'touch', 'pen'] as const)(
  'selects without hover and moves through %s input in one undo step',
  async (pointerType) => {
    await world.pointer(api, 'pointerdown', 45, 45, { pointerType });
    expect(api.getAppState().layersSelected).toEqual(['a']);
    expect(api.getEntity(node()).has(Selected)).toBe(true);
    await world.pointer(api, 'pointermove', 65, 60, { pointerType });
    expect(node()).toMatchObject({ x: 50, y: 45 });
    await world.pointer(api, 'pointermove', 75, 65, { pointerType });
    await world.pointer(api, 'pointerup', 75, 65, { pointerType });
    expect(node()).toMatchObject({ x: 60, y: 50 });
    expect(api.getCanvas().read(Canvas).inputPoints.length).toBe(0);
    await world.history(api, 'undo');
    expect(node()).toMatchObject({ x: 30, y: 30 });
    expect(api.isUndoStackEmpty()).toBe(true);
    await world.history(api, 'redo');
    expect(node()).toMatchObject({ x: 60, y: 50 });
  },
);

it('stops a cancelled drag and starts the next press from the current position', async () => {
  await world.pointer(api, 'pointerdown', 45, 45);
  await world.pointer(api, 'pointermove', 65, 60);
  const stopped = { x: node().x, y: node().y };
  await world.pointer(api, 'pointercancel', 65, 60);
  expect(api.getCanvas().read(Canvas).inputPoints.length).toBe(0);
  await world.pointer(api, 'pointermove', 95, 90);
  expect(node()).toMatchObject(stopped);
  expect(tf().status).not.toBe(TransformableStatus.MOVING);
  await world.pointer(api, 'pointerup', 95, 90);
  await world.pointer(api, 'pointerdown', stopped.x + 15, stopped.y + 15);
  await world.pointer(api, 'pointermove', stopped.x + 25, stopped.y + 20);
  await world.pointer(api, 'pointerup', stopped.x + 25, stopped.y + 20);
  expect(node()).toMatchObject({ x: stopped.x + 10, y: stopped.y + 5 });
});

it('adds and toggles selection with Shift, then clears on an empty click', async () => {
  await world.reset(api, [rect(), rect('b', { x: 130, width: 40 })]);
  await world.click(api, 45, 45);
  await world.click(api, 145, 45, { shiftKey: true });
  expect([...api.getAppState().layersSelected].sort()).toEqual(['a', 'b']);
  await world.click(api, 45, 45, { shiftKey: true });
  expect(api.getAppState().layersSelected).toEqual(['b']);
  expect(api.getEntity(node()).has(Selected)).toBe(false);
  await world.click(api, 190, 190);
  expect(api.getAppState().layersSelected).toEqual([]);
  expect(tf().selecteds).toHaveLength(0);
});

it.each([{ locked: true }, { visibility: 'hidden' as const }])(
  'ignores an unavailable target: %j',
  async (patch) => {
    await world.reset(api, [rect('a', patch)]);
    await world.click(api, 45, 45);
    expect(api.getAppState().layersSelected).toEqual([]);
    expect(api.getEntity(node()).has(Selected)).toBe(false);
  },
);

it('updates marquee selection before release and ignores sub-threshold movement', async () => {
  await world.reset(api, [rect(), rect('b', { x: 130, width: 40 })]);
  await world.pointer(api, 'pointerdown', 5, 5);
  await world.pointer(api, 'pointermove', 8, 8);
  expect(api.getAppState().layersSelected).toEqual([]);
  await world.pointer(api, 'pointermove', 100, 90);
  expect(api.getAppState().layersSelected).toEqual(['a']);
  await world.pointer(api, 'pointermove', 190, 100);
  expect([...api.getAppState().layersSelected].sort()).toEqual(['a', 'b']);
  await world.pointer(api, 'pointerup', 190, 100);
  expect(tf().selecteds).toHaveLength(2);
});

it.each([
  ['top-left', [30, 30], [20, 20], { x: 20, y: 20, width: 70, height: 50 }],
  ['top-right', [90, 30], [100, 20], { x: 30, y: 20, width: 70, height: 50 }],
  ['bottom-left', [30, 70], [20, 80], { x: 20, y: 30, width: 70, height: 50 }],
  [
    'bottom-right',
    [90, 70],
    [100, 80],
    { x: 30, y: 30, width: 70, height: 50 },
  ],
  ['top', [60, 30], [60, 20], { x: 30, y: 20, width: 60, height: 50 }],
  ['bottom', [60, 70], [60, 80], { x: 30, y: 30, width: 60, height: 50 }],
  ['left', [30, 50], [20, 50], { x: 20, y: 30, width: 70, height: 40 }],
  ['right', [90, 50], [100, 50], { x: 30, y: 30, width: 70, height: 40 }],
] as const)(
  'resizes from %s and commits exactly one undo step',
  async (_, start, end, expected) => {
    await select();
    await world.pointer(api, 'pointerdown', start[0], start[1]);
    await world.pointer(api, 'pointermove', end[0], end[1]);
    expect(tf().status).toBe(TransformableStatus.RESIZING);
    await world.pointer(api, 'pointerup', end[0], end[1]);
    expectGeometry(expected);
    expect(api.getEntity(node()).read(Rect).width).toBeCloseTo(
      expected.width,
      4,
    );
    expect(tf().status).toBe(TransformableStatus.RESIZED);
    await world.history(api, 'undo');
    expect(node()).toMatchObject({ x: 30, y: 30, width: 60, height: 40 });
    expect(api.isUndoStackEmpty()).toBe(true);
    await world.history(api, 'redo');
    expectGeometry(expected);
  },
);

it('applies Shift aspect locking and Alt centered scaling through real pointer modifiers', async () => {
  await select();
  await world.pointer(api, 'pointerdown', 90, 70);
  await world.pointer(api, 'pointermove', 120, 90, { shiftKey: true });
  await world.pointer(api, 'pointerup', 120, 90, { shiftKey: true });
  expect(node().width / node().height).toBeCloseTo(1.5);
  await world.history(api, 'undo');
  await world.frames();
  await world.pointer(api, 'pointerdown', 90, 70);
  await world.pointer(api, 'pointermove', 100, 80, { altKey: true });
  await world.pointer(api, 'pointerup', 100, 80, { altKey: true });
  expectGeometry({ x: 20, y: 20, width: 80, height: 60 });
  await world.key(api, 'Alt');
});

it('retains the touch grab offset without jumping to the resize anchor', async () => {
  await select();
  await world.pointer(api, 'pointerdown', 100, 80, { pointerType: 'touch' });
  await world.pointer(api, 'pointermove', 110, 90, { pointerType: 'touch' });
  await world.pointer(api, 'pointerup', 110, 90, { pointerType: 'touch' });
  expectGeometry({ x: 30, y: 30, width: 70, height: 50 });
});

it('rotates from a corner ring, commits on release, and starts a fresh resize', async () => {
  await select();
  await world.pointer(api, 'pointerdown', 100, 20);
  await world.pointer(api, 'pointermove', 90, 90);
  expect(tf().status).toBe(TransformableStatus.ROTATING);
  expect(node().rotation).toBeCloseTo(Math.PI / 2);
  await world.pointer(api, 'pointerup', 90, 90);
  expect(tf().status).toBe(TransformableStatus.ROTATED);
  expect(tf().transformerObbFrozenDuringRotate).toBe(false);
  await world.history(api, 'undo');
  await world.frames();
  expect(node().rotation ?? 0).toBe(0);
  await world.pointer(api, 'pointerdown', 90, 70);
  await world.pointer(api, 'pointermove', 100, 80);
  await world.pointer(api, 'pointerup', 100, 80);
  expectGeometry({ width: 70, height: 50 });
  expect(api.getHistoryState().canRedo).toBe(false);
});

it('pins the rotation pivot on hover/drag and resets it when selection changes', async () => {
  await world.reset(api, [rect(), rect('b', { x: 130, width: 40 })]);
  await select();
  await world.pointer(api, 'pointermove', 60, 50);
  expect(api.getCanvas().read(Cursor).value).toBe('move');
  await world.pointer(api, 'pointerdown', 60, 50);
  await world.pointer(api, 'pointermove', 70, 60);
  await world.pointer(api, 'pointerup', 70, 60);
  expect(tf().rotatePivotPinned).toBe(true);
  expect(tf().rotatePivotX).toBeCloseTo(40);
  expect(tf().rotatePivotY).toBeCloseTo(30);
  expect(node()).toMatchObject({ x: 30, y: 30 });
  await world.click(api, 145, 45);
  expect(api.getAppState().layersSelected).toEqual(['b']);
  expect(tf().rotatePivotPinned).toBe(false);
});

it('clears selected components and hover on Escape and accepts the next click', async () => {
  await select();
  await world.pointer(api, 'pointermove', 45, 45);
  await world.key(api, 'Escape');
  expect(api.getAppState().layersSelected).toEqual([]);
  expect(api.getEntity(node()).has(Selected)).toBe(false);
  expect(api.getEntity(node()).has(Highlighted)).toBe(false);
  await world.click(api, 45, 45);
  expect(api.getAppState().layersSelected).toEqual(['a']);
});

it.each(['pointercancel', 'Escape', 'tool'] as const)(
  'releases a multi-selection rotating frame on %s, including a trailing release',
  async (action) => {
    await world.reset(api, [rect(), rect('b', { x: 130, width: 40 })]);
    await select(['a', 'b']);
    // Union bounds are (30,30)-(170,70), centered at (100,50).
    await world.pointer(api, 'pointerdown', 180, 20);
    await world.pointer(api, 'pointermove', 130, 130);
    expect(tf().transformerObbFrozenDuringRotate).toBe(true);
    expect(tf().gestureFrozenSelectionOBB.rotation).toBeCloseTo(Math.PI / 2);
    const rotated = api
      .getNodes()
      .map((n) => ({ id: n.id, x: n.x, y: n.y, rotation: n.rotation }));
    const cameraBefore = api.viewport2Canvas({ x: 100, y: 100 });
    if (action === 'pointercancel')
      await world.pointer(api, 'pointercancel', 130, 130);
    else if (action === 'Escape') await world.key(api, 'Escape');
    else {
      api.setAppState({ penbarSelected: Pen.HAND });
      await world.frames();
    }
    expect(tf().transformerObbFrozenDuringRotate).toBe(false);
    expect(api.getCanvas().read(Canvas).inputPoints).toHaveLength(0);
    expect(api.viewport2Canvas({ x: 100, y: 100 })).toEqual(cameraBefore);
    await world.pointer(api, 'pointerup', 130, 130);
    api.setAppState({ penbarSelected: Pen.SELECT });
    await world.frames();
    expect(api.getNodes()).toEqual(
      expect.arrayContaining(rotated.map((n) => expect.objectContaining(n))),
    );
    await select(['a', 'b']);
    // Interruption retained the displayed transform as one undoable operation.
    await world.history(api, 'undo');
    expect(api.getNodeById('a').rotation ?? 0).toBeCloseTo(0);
    expect(api.getNodeById('b').rotation ?? 0).toBeCloseTo(0);
    expect(tf().transformerObbFrozenDuringRotate).toBe(false);
  },
);

it('ignores a press cancelled in the same frame without changing selection or history', async () => {
  world.dispatch(api, 'pointerdown', 45, 45, { pointerType: 'touch' });
  world.dispatch(api, 'pointercancel', 45, 45, { pointerType: 'touch' });
  world.dispatch(api, 'pointerup', 45, 45, { pointerType: 'touch' });
  await world.frames();
  expect(api.getAppState().layersSelected).toEqual([]);
  expect(api.isUndoStackEmpty()).toBe(true);
  expect(api.getCanvas().read(Canvas).inputPoints.length).toBe(0);
  await world.click(api, 45, 45, { pointerType: 'touch' });
  expect(api.getAppState().layersSelected).toEqual(['a']);
});

it('does not select hidden descendants or hidden roots during marquee selection', async () => {
  await world.reset(api, [
    { id: 'group', type: 'g', x: 0, y: 0, zIndex: 0, visibility: 'hidden' },
    rect('a', { parentId: 'group' }),
    rect('b', { x: 110, width: 40, visibility: 'hidden' }),
    rect('c', { x: 50, y: 110 }),
  ]);
  await world.click(api, 45, 45);
  expect(api.getAppState().layersSelected).toEqual([]);
  await world.pointer(api, 'pointerdown', 5, 5);
  await world.pointer(api, 'pointermove', 190, 180);
  expect(api.getAppState().layersSelected).toEqual(['c']);
  await world.pointer(api, 'pointerup', 190, 180);
});

it.each(['pointercancel', 'pointerleave', 'Escape'] as const)(
  'ends an active resize on %s and keeps its last geometry undoable',
  async (action) => {
    await select();
    await world.pointer(api, 'pointerdown', 90, 70);
    await world.pointer(api, 'pointermove', 100, 80);
    if (action === 'Escape') await world.key(api, 'Escape');
    else await world.pointer(api, action, 100, 80);
    expect(api.getCanvas().read(Canvas).inputPoints).toHaveLength(0);
    expect(tf().status).not.toBe(TransformableStatus.RESIZING);
    await world.pointer(api, 'pointermove', 150, 150);
    await world.pointer(api, 'pointerup', 150, 150);
    expectGeometry({ x: 30, y: 30, width: 70, height: 50 });
    await world.history(api, 'undo');
    expectGeometry({ x: 30, y: 30, width: 60, height: 40 });
    expect(api.isUndoStackEmpty()).toBe(true);
    await world.history(api, 'redo');
    expectGeometry({ x: 30, y: 30, width: 70, height: 50 });
  },
);

it.each(['source', 'target'] as const)(
  'detaches and rebinds the %s endpoint without changing the opposite binding',
  async (end) => {
    await world.reset(api, [
      rect('source', { x: 20, y: 40, width: 30, height: 30 }),
      rect('target', { x: 140, y: 40, width: 30, height: 30 }),
      rect('third', { x: 100, y: 130, width: 40, height: 40 }),
      {
        id: 'edge',
        type: 'line',
        x: 50,
        y: 55,
        width: 90,
        height: 0,
        x1: 0,
        y1: 0,
        x2: 90,
        y2: 0,
        fromId: 'source',
        toId: 'target',
        strokes: [{ type: 'solid', value: 'black' }],
        strokeWidth: 2,
        zIndex: 2,
      },
    ]);
    await select(['edge']);
    const edge = () => api.getNodeById('edge');
    const binding = end === 'source' ? 'fromId' : 'toId';
    const opposite = end === 'source' ? 'toId' : 'fromId';
    const floating = end === 'source' ? 'sourcePoint' : 'targetPoint';
    const dragTo = async (x: number, y: number) => {
      const anchor = end === 'source' ? tf().x1y1Anchor : tf().x2y2Anchor;
      const { cx, cy } = anchor.read(Circle);
      const point = api.canvas2Viewport(
        api.transformer2Canvas({ x: cx, y: cy }, anchor),
      );
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      await world.pointer(api, 'pointerdown', point.x, point.y);
      await world.pointer(api, 'pointermove', x, y);
      await world.pointer(api, 'pointerup', x, y);
    };
    await dragTo(70, 170);
    expect(edge()[binding]).toBeUndefined();
    expect(edge()[floating]).toEqual({ x: 70, y: 170 });
    expect(edge()[opposite]).toBe(end === 'source' ? 'target' : 'source');
    await world.history(api, 'undo');
    expect(edge()[binding]).toBe(end);
    expect(edge()[floating]).toBeUndefined();
    await world.history(api, 'redo');
    expect(edge()[floating]).toEqual({ x: 70, y: 170 });
    await world.frames();
    await dragTo(120, 150);
    expect(edge()[binding]).toBe('third');
    expect(edge()[floating]).toBeUndefined();
    expect(edge()[opposite]).toBe(end === 'source' ? 'target' : 'source');
    await world.history(api, 'undo');
    expect(edge()[floating]).toEqual({ x: 70, y: 170 });
    await world.history(api, 'redo');
    expect(edge()[binding]).toBe('third');
  },
);

it('keeps a pinned multi-selection pivot at the same world position after rotation', async () => {
  await world.reset(api, [rect(), rect('b', { x: 130, width: 40 })]);
  await select(['a', 'b']);
  await world.pointer(api, 'pointermove', 100, 50);
  await world.pointer(api, 'pointerdown', 100, 50);
  await world.pointer(api, 'pointermove', 110, 60);
  await world.pointer(api, 'pointerup', 110, 60);
  expect(tf().rotatePivotPinned).toBe(true);
  await world.pointer(api, 'pointerdown', 180, 20);
  // (70,-40) rotated 90 degrees around the new pivot (110,60).
  await world.pointer(api, 'pointermove', 150, 130);
  expect(tf().gestureFrozenSelectionOBB.rotation).toBeCloseTo(Math.PI / 2);
  await world.pointer(api, 'pointerup', 150, 130);
  const pivot = api.transformer2Canvas(
    { x: tf().rotatePivotX, y: tf().rotatePivotY },
    tf().mask,
  );
  expect(pivot.x).toBeCloseTo(110, 4);
  expect(pivot.y).toBeCloseTo(60, 4);
  expect(tf().transformerObbFrozenDuringRotate).toBe(false);
  await world.history(api, 'undo');
  expect(api.getNodeById('a').rotation ?? 0).toBeCloseTo(0);
  expect(api.getNodeById('b').rotation ?? 0).toBeCloseTo(0);
});

it('isolates selection, transforms, cancellation and history between canvases with identical ids', async () => {
  const other = world.apis[1];
  await world.reset(other, [rect()]);
  await world.pointer(api, 'pointerdown', 45, 45);
  await world.pointer(api, 'pointermove', 65, 60);
  await world.pointer(api, 'pointercancel', 65, 60);
  expect(other.getAppState().layersSelected).toEqual([]);
  expect(other.getNodeById('a')).toMatchObject({ x: 30, y: 30 });
  expect(other.isUndoStackEmpty()).toBe(true);
  await world.pointer(other, 'pointerdown', 45, 45);
  await world.pointer(other, 'pointermove', 55, 65);
  await world.pointer(other, 'pointerup', 55, 65);
  expect(other.getNodeById('a')).toMatchObject({ x: 40, y: 50 });
  expect(node()).toMatchObject({ x: 50, y: 45 });
  await world.history(api, 'undo');
  expect(node()).toMatchObject({ x: 30, y: 30 });
  expect(other.getNodeById('a')).toMatchObject({ x: 40, y: 50 });
  await world.history(other, 'undo');
  expect(other.getNodeById('a')).toMatchObject({ x: 30, y: 30 });
  expect(api.getHistoryState().canRedo).toBe(true);
  await world.key(other, 'Escape');
});

it('removes input listeners when a canvas is destroyed during a drag', async () => {
  const other = world.apis[1];
  await world.reset(other, [rect()]);
  await world.pointer(other, 'pointerdown', 45, 45);
  await world.pointer(other, 'pointermove', 65, 60);
  const element = other.getCanvasElement();
  await world.edit(api, () => other.destroy(), 'NEVER');
  await world.frames();
  for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
    const event = new world.window.MouseEvent(type, {
      bubbles: true,
      clientX: 80,
      clientY: 90,
    });
    Object.defineProperties(event, {
      pointerType: { value: 'mouse' },
      pointerId: { value: 1 },
    });
    element.dispatchEvent(event);
  }
  world.assertNoErrors();
  await world.frames();
  expect(other.getNodes()).toEqual([]);
  expect(api.isUndoStackEmpty()).toBe(true);
  await world.click(api, 45, 45);
  expect(api.getAppState().layersSelected).toEqual(['a']);
  expect(node()).toMatchObject({ x: 30, y: 30 });
});
