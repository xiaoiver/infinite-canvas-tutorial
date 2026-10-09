import {
  Canvas,
  ClipMode,
  ComputedBounds,
  GlobalTransform,
  Highlighted,
  Locked,
  Pen,
  Selected,
  type API,
  type SerializedNode,
  type RectSerializedNode,
} from '../../packages/ecs/src';
import { createSelectionWorld } from '../helpers/ecs-selection';

const rect = (
  id: string,
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
const group = (
  id: string,
  patch: Partial<SerializedNode> = {},
): SerializedNode =>
  ({
    id,
    type: 'g',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    zIndex: 0,
    ...patch,
  } as SerializedNode);
let world: Awaited<ReturnType<typeof createSelectionWorld>>;
let api: API;
beforeAll(async () => {
  world = await createSelectionWorld(2);
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
        layersCropping: [],
        snapToObjectsEnabled: false,
        snapToPixelGridEnabled: false,
      }),
    'NEVER',
  );
  await world.reset(api, []);
  await world.frames();
});
afterAll(async () => {
  await world?.dispose();
});
const node = (id: string) => api.getNodeById(id);
const entity = (id: string) => api.getEntity(node(id));
const position = (id: string) => {
  const m = entity(id).read(GlobalTransform).matrix;
  return { x: m.m20, y: m.m21 };
};
const expectPosition = (id: string, expected: { x: number; y: number }) => {
  const actual = position(id);
  expect(actual.x).toBeCloseTo(expected.x, 3);
  expect(actual.y).toBeCloseTo(expected.y, 3);
};
const select = async (ids: string[]) => {
  await world.edit(
    api,
    (editor) => editor.selectNodes(ids.map((id) => node(id))),
    'NEVER',
  );
  await world.frames();
};
async function cropScene() {
  await world.reset(api, [
    rect('mask', {
      x: 40,
      y: 40,
      width: 80,
      height: 60,
      clipMode: 'clip',
      fills: [],
    }),
    rect('content', {
      parentId: 'mask',
      x: 10,
      y: 10,
      width: 40,
      height: 30,
      locked: true,
    }),
  ]);
  await world.frames();
  api.clearHistory();
}
async function enterCrop() {
  await world.edit(
    api,
    (editor) => editor.setAppState({ layersCropping: ['mask'] }),
    'NEVER',
  );
  await world.frames();
}
function expectCropFinished() {
  expect(api.getAppState().layersCropping).toEqual([]);
  expect(api.getAppState().layersSelected).toEqual(['mask']);
  expect(entity('mask').read(ClipMode).value).toBe('clip');
  expect(entity('mask').has(Locked)).toBe(false);
  expect(entity('content').has(Locked)).toBe(true);
}

it('enters crop with a soft locked mask and the content selected', async () => {
  await cropScene();
  await enterCrop();
  expect(node('mask')).toMatchObject({ clipMode: 'soft', locked: true });
  expect(entity('mask').read(ClipMode).value).toBe('soft');
  expect(api.getAppState().layersSelected).toEqual(['content']);
  expect(entity('content').has(Selected)).toBe(true);
});

it.each(['apply', 'Escape', 'outside'] as const)(
  'moves crop content without moving the mask, then exits with %s',
  async (exit) => {
    await cropScene();
    await enterCrop();
    const before = position('mask');
    await world.pointer(api, 'pointerdown', 65, 65);
    await world.pointer(api, 'pointermove', 75, 70);
    await world.pointer(api, 'pointerup', 75, 70);
    expect(node('content')).toMatchObject({ x: 20, y: 15 });
    expect(position('mask')).toEqual(before);
    if (exit === 'apply') await world.edit(api, (editor) => editor.applyCrop());
    else if (exit === 'Escape') await world.key(api, 'Escape');
    else await world.click(api, 185, 180);
    await world.frames();
    expectCropFinished();
    const moved = position('content');
    await world.history(api, 'undo');
    expect(node('content')).toMatchObject({ x: 10, y: 10 });
    await world.history(api, 'redo');
    expect(position('content')).toEqual(moved);
  },
);

it('finishes crop when switching to the hand tool and releases its temporary mask lock', async () => {
  await cropScene();
  await enterCrop();
  await world.edit(
    api,
    (editor) => editor.setAppState({ penbarSelected: Pen.HAND }),
    'NEVER',
  );
  await world.frames();
  expect(api.getAppState().layersCropping).toEqual([]);
  expect(entity('mask').read(ClipMode).value).toBe('clip');
  expect(entity('mask').has(Locked)).toBe(false);
  expect(api.getAppState().layersSelected).toEqual([]);
});

it('ignores an empty crop container without selecting an undefined child', async () => {
  await world.reset(api, [rect('mask', { clipMode: 'clip' })]);
  await enterCrop();
  expect(api.getAppState().layersCropping).toEqual([]);
  expect(node('mask').clipMode).toBe('clip');
  expect(entity('mask').has(Locked)).toBe(false);
});

it('clears a stale crop target instead of leaving the canvas in crop mode', async () => {
  await world.edit(
    api,
    (editor) => editor.setAppState({ layersCropping: ['missing'] }),
    'NEVER',
  );
  await world.frames();
  expect(api.getAppState().layersCropping).toEqual([]);
  expect(api.getAppState().layersSelected).toEqual([]);
});

async function nestedScene() {
  await world.reset(api, [
    group('outer', { x: 20, y: 20 }),
    group('inner', { parentId: 'outer', x: 10, y: 10 }),
    rect('leaf', { parentId: 'inner', x: 0, y: 0, width: 60, height: 40 }),
    rect('sibling', { parentId: 'outer', x: 70, y: 10, width: 30, height: 40 }),
  ]);
  await world.frames();
}

it('highlights the outermost group when hovering a nested leaf', async () => {
  await nestedScene();
  await world.pointer(api, 'pointermove', 45, 45);
  expect(api.getAppState().layersHighlighted).toEqual(['outer']);
  expect(entity('outer').has(Highlighted)).toBe(true);
  expect(entity('leaf').has(Highlighted)).toBe(false);
});

it('marquee selects only the outer group, without duplicate nested selections', async () => {
  await nestedScene();
  await world.pointer(api, 'pointerdown', 5, 5);
  await world.pointer(api, 'pointermove', 160, 110);
  expect(api.getAppState().layersSelected).toEqual(['outer']);
  await world.pointer(api, 'pointerup', 160, 110);
  expect(entity('outer').has(Selected)).toBe(true);
  expect(entity('leaf').has(Selected)).toBe(false);
});

it('resizes nested group descendants exactly once and restores their world bounds on undo', async () => {
  await nestedScene();
  await select(['outer']);
  const original = ['leaf', 'sibling'].map(position);
  // Union bounds: (30, 30) to (120, 70).
  await world.pointer(api, 'pointerdown', 120, 70);
  await world.pointer(api, 'pointermove', 165, 90);
  await world.pointer(api, 'pointerup', 165, 90);
  expect(node('leaf').width).toBeCloseTo(90);
  expect(node('leaf').height).toBeCloseTo(60);
  expect(node('sibling').width).toBeCloseTo(45);
  expectPosition('leaf', { x: 30, y: 30 });
  expectPosition('sibling', { x: 120, y: 30 });
  await world.history(api, 'undo');
  ['leaf', 'sibling'].forEach((id, i) => expectPosition(id, original[i]));
  await world.history(api, 'redo');
  expect(node('leaf').width).toBeCloseTo(90);
  expect(
    entity('outer').read(ComputedBounds).geometryBounds.maxX,
  ).toBeGreaterThan(0);
});

it('moves a selected leaf in parent coordinates and preserves its siblings', async () => {
  await nestedScene();
  await select(['leaf']);
  const sibling = position('sibling');
  await world.pointer(api, 'pointerdown', 45, 45);
  await world.pointer(api, 'pointermove', 55, 50);
  await world.pointer(api, 'pointerup', 55, 50);
  expect(position('leaf')).toEqual({ x: 40, y: 35 });
  expect(node('leaf')).toMatchObject({ x: 10, y: 5 });
  expect(position('sibling')).toEqual(sibling);
  await world.history(api, 'undo');
  expect(position('leaf')).toEqual({ x: 30, y: 30 });
});

it('does not leak crop mode into another canvas with the same ids', async () => {
  await cropScene();
  const other = world.apis[1];
  await world.reset(other, [
    rect('mask'),
    rect('content', { x: 120, width: 40 }),
  ]);
  await enterCrop();
  await world.click(other, 135, 45);
  expect(other.getAppState().layersSelected).toEqual(['content']);
  expect(other.getAppState().layersCropping).toEqual([]);
  expect(api.getAppState().layersCropping).toEqual(['mask']);
  expect(api.getCanvas().read(Canvas).inputPoints).toHaveLength(0);
});

it.each(['mask', 'content'])(
  'exits crop cleanly when %s is deleted',
  async (id) => {
    await cropScene();
    await enterCrop();
    await world.edit(api, (editor) => editor.deleteNodesById([id]), 'NEVER');
    await world.frames();
    expect(api.getAppState().layersCropping).toEqual([]);
    if (id === 'content') {
      expect(node('mask').clipMode).toBe('clip');
      expect(entity('mask').has(Locked)).toBe(false);
    }
    await world.pointer(api, 'pointermove', 180, 180);
    await world.key(api, 'Escape');
  },
);

it('restores hover after cancellation without resuming the cancelled drag', async () => {
  await world.reset(api, [rect('leaf')]);
  await world.pointer(api, 'pointerdown', 45, 45);
  await world.pointer(api, 'pointermove', 55, 50);
  await world.pointer(api, 'pointercancel', 55, 50);
  const stopped = position('leaf');
  await world.pointer(api, 'pointermove', 185, 180);
  await world.pointer(api, 'pointermove', 55, 50);
  expect(api.getAppState().layersHighlighted).toEqual(['leaf']);
  expect(position('leaf')).toEqual(stopped);
  expect(api.getCanvas().read(Canvas).inputPoints).toHaveLength(0);
});
