import {
  Children,
  GlobalTransform,
  Highlighted,
  Locked,
  Name,
  Opacity,
  Parent,
  Rect,
  Selected,
  Stroke,
  Visibility,
  ZIndex,
  DropShadow,
  InnerShadow,
  LockAspectRatio,
  SizeAttenuation,
  StrokeAttenuation,
  type API,
  type SerializedNode,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';

const rect = (id = 'a', patch: Partial<SerializedNode> = {}): SerializedNode =>
  ({
    id,
    type: 'rect',
    zIndex: 0,
    x: 10,
    y: 20,
    width: 40,
    height: 30,
    fills: [{ type: 'solid', value: 'red' }],
    ...patch,
  } as SerializedNode);
const group = (
  id: string,
  patch: Partial<SerializedNode> = {},
): SerializedNode =>
  ({
    id,
    type: 'g',
    zIndex: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    ...patch,
  } as SerializedNode);
let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
let other: API;
let disposers: (() => void)[];
beforeAll(async () => {
  world = await createDocumentWorld(2);
  [api, other] = world.apis;
});
beforeEach(async () => {
  disposers = [];
  await world.reset(api, [rect()]);
  await world.reset(other, [rect('a', { width: 80 })]);
});
afterEach(() => {
  disposers.forEach((dispose) => dispose());
  api.onchange = undefined;
});
afterAll(async () => {
  await world?.dispose();
});

function entity(id = 'a', canvas = api) {
  return canvas.getEntity(canvas.getNodeById(id));
}
function expectWidth(width: number, id = 'a', canvas = api) {
  expect(canvas.getNodeById(id).width).toBe(width);
  expect(entity(id, canvas).read(Rect).width).toBe(width);
}

it('undoes a local edit while retaining remote fields and inserts, without echoing the remote commit', async () => {
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('a'), { width: 70 }),
  );
  const changed = jest.fn();
  const legacy = jest.fn();
  disposers.push(api.subscribe(changed));
  api.onchange = legacy;
  const remote = [
    rect('a', {
      width: 70,
      name: 'remote',
      fills: [{ type: 'solid', value: 'blue' }],
    }),
    rect('remote-only', { x: 100 }),
  ];
  const original = structuredClone(remote);
  await world.edit(api, (editor) => editor.replaceDocument(remote), 'NEVER');
  expect(remote).toEqual(original);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(legacy).not.toHaveBeenCalled();
  changed.mockClear();
  await world.history(api, 'undo');
  expectWidth(40);
  expect(api.getNodeById('a')).toMatchObject({
    name: 'remote',
    fills: [{ type: 'solid', value: 'blue' }],
  });
  expect(entity().read(Name).value).toBe('remote');
  expect(api.getNodeById('remote-only')).toBeDefined();
  expect(changed).toHaveBeenCalledTimes(1);
  expect(legacy).toHaveBeenCalledTimes(1);
  await world.history(api, 'redo');
  expectWidth(70);
  expect(api.getNodeById('remote-only')).toBeDefined();
  expectWidth(80, 'a', other);
  expect(other.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
});

it('keeps redo after remote edits and selection changes, but clears it after a new local document edit', async () => {
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('a'), { width: 70 }),
  );
  await world.history(api, 'undo');
  await world.edit(
    api,
    (editor) => editor.replaceDocument([rect('a', { name: 'remote' })]),
    'NEVER',
  );
  await world.edit(api, (editor) =>
    editor.selectNodes([editor.getNodeById('a')]),
  );
  expect(api.getHistoryState().canRedo).toBe(true);
  await world.history(api, 'redo');
  expectWidth(70);
  expect(entity().has(Selected)).toBe(true);
  expect(api.getNodeById('a').name).toBe('remote');
  await world.history(api, 'undo');
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('a'), { height: 55 }),
  );
  expect(api.getHistoryState().canRedo).toBe(false);
  await world.history(api, 'redo');
  expect(api.getNodeById('a').height).toBe(55);
});

it('skips edits to a remotely removed node when undoing the next visible change', async () => {
  await world.reset(api, [rect('a'), rect('b', { x: 90 })]);
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('b'), { width: 90 }),
  );
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('a'), { width: 70 }),
  );
  await world.edit(
    api,
    (editor) => editor.replaceDocument([editor.getNodeById('b')]),
    'NEVER',
  );
  await world.history(api, 'undo');
  expect(api.getNodeById('a')).toBeUndefined();
  expectWidth(40, 'b');
  await world.history(api, 'redo');
  expectWidth(90, 'b');
  expect(api.getNodeById('a')).toBeUndefined();
});

it('restores a deleted hierarchy, parent links and the selected descendant in one undo', async () => {
  await world.reset(api, [
    group('root', { x: 50 }),
    group('nested', { parentId: 'root', x: 20 }),
    rect('a', { parentId: 'nested' }),
    rect('unrelated'),
  ]);
  await world.edit(
    api,
    (editor) => {
      editor.selectNodes([editor.getNodeById('a')]);
      editor.highlightNodes([editor.getNodeById('a')]);
    },
    'NEVER',
  );
  await world.edit(api, (editor) =>
    editor.deleteNodesById(['root', 'nested', 'missing']),
  );
  expect(api.getNodes().map((node) => node.id)).toEqual(['unrelated']);
  expect(api.getAppState().layersSelected).toEqual([]);
  expect(api.getAppState().layersHighlighted).toEqual([]);
  await world.history(api, 'undo');
  expect(
    api
      .getNodes()
      .map((node) => node.id)
      .sort(),
  ).toEqual(['a', 'nested', 'root', 'unrelated']);
  expect(api.getAppState().layersSelected).toEqual(['a']);
  expect(entity().has(Selected)).toBe(true);
  expect(entity().has(Highlighted)).toBe(false);
  expect(api.getNodeByEntity(entity().read(Children).parent).id).toBe('nested');
  expect(api.getNodeByEntity(entity('nested').read(Children).parent).id).toBe(
    'root',
  );
  expect(entity().read(GlobalTransform).matrix.m20).toBe(80);
  expect(api.isUndoStackEmpty()).toBe(true);
  await world.history(api, 'redo');
  expect(api.getNodes().map((node) => node.id)).toEqual(['unrelated']);
});

it('preserves selection through reparenting and restores ECS parent links on undo and redo', async () => {
  await world.reset(api, [
    group('left', { x: 10 }),
    group('right', { x: 100 }),
    rect('a', { parentId: 'left' }),
  ]);
  await world.edit(
    api,
    (editor) => editor.selectNodes([editor.getNodeById('a')]),
    'NEVER',
  );
  const move = () =>
    api
      .getNodes()
      .map((node) =>
        node.id === 'a' ? { ...node, parentId: 'right', x: 5 } : node,
      );
  await world.edit(api, (editor) => editor.replaceDocument(move(), 'local'));
  for (const [action, parent, x] of [
    [undefined, 'right', 105],
    ['undo', 'left', 20],
    ['redo', 'right', 105],
  ] as const) {
    if (action) await world.history(api, action);
    expect(api.getAppState().layersSelected).toEqual(['a']);
    expect(entity().has(Selected)).toBe(true);
    expect(api.getNodeByEntity(entity().read(Children).parent).id).toBe(parent);
    expect(entity().read(GlobalTransform).matrix.m20).toBe(x);
    expect(
      entity(parent)
        .read(Parent)
        .children.some((child) => api.getNodeByEntity(child)?.id === 'a'),
    ).toBe(true);
  }
});

it.each([
  ['duplicate ids', () => [rect(), rect()]],
  ['missing parent', () => [rect('a', { parentId: 'missing' })]],
  [
    'cycle',
    () => [
      group('one', { parentId: 'two' }),
      group('two', { parentId: 'one' }),
    ],
  ],
] as const)(
  'rejects %s before changing the document, selection or redo stack',
  async (_, incoming) => {
    await world.edit(api, (editor) =>
      editor.updateNode(editor.getNodeById('a'), { width: 70 }),
    );
    await world.history(api, 'undo');
    const before = structuredClone(api.getNodes());
    const beforeEntity = entity();
    const changed = jest.fn();
    disposers.push(api.subscribe(changed));
    await expect(
      world.edit(api, (editor) => editor.replaceDocument(incoming(), 'local')),
    ).rejects.toThrow();
    expect(api.getNodes()).toEqual(before);
    expect(entity()).toBe(beforeEntity);
    expect(api.getHistoryState()).toEqual({ canUndo: false, canRedo: true });
    expect(changed).not.toHaveBeenCalled();
    await world.history(api, 'redo');
    expectWidth(70);
  },
);

it('does not capture pending changes or clear redo for a cancelled edit', async () => {
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('a'), { width: 70 }),
  );
  await world.history(api, 'undo');
  api.runAtNextTick(() => api.updateNode(api.getNodeById('a'), { height: 75 }));
  await world.frame();
  const controller = new AbortController();
  const update = jest.fn();
  const pending = api.edit(update, { signal: controller.signal });
  controller.abort();
  await world.frame();
  expect(await pending).toBe(false);
  expect(update).not.toHaveBeenCalled();
  expect(api.getHistoryState()).toEqual({ canUndo: false, canRedo: true });
  expect(api.getNodeById('a').height).toBe(75);
  await world.history(api, 'redo');
  expectWidth(70);
  expect(api.getNodeById('a').height).toBe(75);
});

it.each([
  {
    patch: { name: 'renamed' },
    read: () => entity().read(Name).value,
    expected: 'renamed',
  },
  {
    patch: { opacity: 0.25 },
    read: () => entity().read(Opacity).opacity,
    expected: 0.25,
  },
  {
    patch: { visibility: 'hidden' },
    read: () => entity().read(Visibility).value,
    expected: 'hidden',
  },
  { patch: { locked: true }, read: () => entity().has(Locked), expected: true },
  {
    patch: { lockAspectRatio: true },
    read: () => entity().has(LockAspectRatio),
    expected: true,
  },
  {
    patch: { sizeAttenuation: true },
    read: () => entity().has(SizeAttenuation),
    expected: true,
  },
  {
    patch: { strokeAttenuation: true },
    read: () => entity().has(StrokeAttenuation),
    expected: true,
  },
  {
    patch: { strokeLinecap: 'round' },
    read: () => entity().read(Stroke).linecap,
    expected: 'round',
  },
  {
    patch: { strokeLinejoin: 'bevel' },
    read: () => entity().read(Stroke).linejoin,
    expected: 'bevel',
  },
  {
    patch: { strokeDasharray: '3 5' },
    read: () => {
      const dash = entity().read(Stroke).dasharray;
      return [dash[0], dash[1]];
    },
    expected: [3, 5],
  },
  {
    patch: { strokeDashoffset: 2 },
    read: () => entity().read(Stroke).dashoffset,
    expected: 2,
  },
  {
    patch: { strokeAlignment: 'inner' },
    read: () => entity().read(Stroke).alignment,
    expected: 'inner',
  },
  {
    patch: { strokeDashCap: 'round' },
    read: () => entity().read(Stroke).dashcap,
    expected: 'round',
  },
  {
    patch: {
      dropShadowColor: 'blue',
      dropShadowBlurRadius: 8,
      dropShadowOffsetX: 3,
      dropShadowOffsetY: 4,
    },
    read: () => {
      if (!entity().has(DropShadow)) return null;
      const { color, blurRadius, offsetX, offsetY } = entity().read(DropShadow);
      return { color, blurRadius, offsetX, offsetY };
    },
    expected: { color: 'blue', blurRadius: 8, offsetX: 3, offsetY: 4 },
  },
  {
    patch: {
      innerShadowColor: 'blue',
      innerShadowBlurRadius: 6,
      innerShadowOffsetX: 2,
      innerShadowOffsetY: 5,
    },
    read: () => {
      if (!entity().has(InnerShadow)) return null;
      const { color, blurRadius, offsetX, offsetY } =
        entity().read(InnerShadow);
      return { color, blurRadius, offsetX, offsetY };
    },
    expected: { color: 'blue', blurRadius: 6, offsetX: 2, offsetY: 5 },
  },
])(
  'restores optional attributes and ECS defaults across undo/redo: $patch',
  async ({ patch, read, expected }) => {
    await world.reset(api, [
      rect('a', {
        strokes: [{ type: 'solid', value: 'black' }],
        strokeWidth: 2,
      }),
    ]);
    const before = structuredClone(read());
    await world.edit(api, (editor) =>
      editor.updateNode(
        editor.getNodeById('a'),
        patch as Partial<SerializedNode>,
      ),
    );
    expect(api.getNodeById('a')).toMatchObject(patch);
    expect(read()).toEqual(expected);
    await world.history(api, 'undo');
    for (const key of Object.keys(patch))
      expect(api.getNodeById('a')).not.toHaveProperty(key);
    expect(read()).toEqual(before);
    await world.history(api, 'redo');
    expect(api.getNodeById('a')).toMatchObject(patch);
    expect(read()).toEqual(expected);
  },
);

it.each([
  ['bringToFront', 0, 11],
  ['bringForward', 0, 7.5],
  ['sendToBack', 10, -1],
  ['sendBackward', 10, 2.5],
] as const)(
  'records %s within the current parent and restores ordering on undo/redo',
  async (command, initial, expected) => {
    await world.reset(api, [
      group('parent'),
      rect('a', { parentId: 'parent', zIndex: initial }),
      rect('sibling', { parentId: 'parent', zIndex: 5 }),
      rect('limit', { parentId: 'parent', zIndex: initial === 0 ? 10 : 0 }),
      rect('outside', { zIndex: 999 }),
    ]);
    await world.edit(api, (editor) => editor[command](editor.getNodeById('a')));
    expect(api.getNodeById('a').zIndex).toBe(expected);
    expect(entity().read(ZIndex).value).toBeCloseTo(expected);
    await world.history(api, 'undo');
    expect(api.getNodeById('a').zIndex).toBe(initial);
    expect(entity().read(ZIndex).value).toBe(initial);
    await world.history(api, 'redo');
    expect(entity().read(ZIndex).value).toBeCloseTo(expected);
    expect(api.getNodeById('outside').zIndex).toBe(999);
    expectWidth(80, 'a', other);
  },
);

it.each([
  'bringToFront',
  'bringForward',
  'sendToBack',
  'sendBackward',
] as const)('does not record a no-op %s on an only child', async (command) => {
  const changed = jest.fn();
  disposers.push(api.subscribe(changed));
  await world.edit(api, (editor) => editor[command](editor.getNodeById('a')));
  expect(api.getHistoryState()).toEqual({ canUndo: false, canRedo: false });
  expect(changed).not.toHaveBeenCalled();
});

it('groups siblings once, preserving world positions and restoring the previous selection on undo', async () => {
  await world.reset(api, [
    group('parent', { x: 50 }),
    rect('a', { parentId: 'parent' }),
    rect('b', { parentId: 'parent', x: 100 }),
  ]);
  await world.edit(
    api,
    (editor) =>
      editor.selectNodes([editor.getNodeById('a'), editor.getNodeById('b')]),
    'NEVER',
  );
  const positions = ['a', 'b'].map(
    (id) => entity(id).read(GlobalTransform).matrix.m20,
  );
  await world.edit(api, (editor) =>
    editor.group([
      editor.getNodeById('a'),
      editor.getNodeById('b'),
      editor.getNodeById('a'),
    ]),
  );
  const [groupId] = api.getAppState().layersSelected;
  expect(api.getNodes()).toHaveLength(4);
  expect(api.getNodeById(groupId)).toMatchObject({
    type: 'g',
    parentId: 'parent',
  });
  expect(
    api
      .getChildrenRecursively(api.getNodeById(groupId))
      .map((node) => node.id)
      .sort(),
  ).toEqual(['a', 'b']);
  expect(
    ['a', 'b'].map((id) => entity(id).read(GlobalTransform).matrix.m20),
  ).toEqual(positions);
  await world.history(api, 'undo');
  expect(api.getNodeById(groupId)).toBeUndefined();
  expect(api.getAppState().layersSelected).toEqual(['a', 'b']);
  expect(entity('a').has(Selected)).toBe(true);
  expect(entity('b').has(Selected)).toBe(true);
  expect(api.getNodeById('a').parentId).toBe('parent');
  await world.history(api, 'redo');
  expect(api.getAppState().layersSelected).toEqual([groupId]);
  expect(
    ['a', 'b'].map((id) => entity(id).read(GlobalTransform).matrix.m20),
  ).toEqual(positions);
});

it('ungroups a translated group without deleting its children, then restores it on undo', async () => {
  await world.reset(api, [
    group('parent', { x: 50 }),
    group('nested', { parentId: 'parent', x: 30 }),
    rect('a', { parentId: 'nested' }),
    rect('b', { parentId: 'nested', x: 100 }),
  ]);
  await world.edit(
    api,
    (editor) => editor.selectNodes([editor.getNodeById('nested')]),
    'NEVER',
  );
  await world.edit(api, (editor) =>
    editor.ungroup(editor.getNodeById('nested')),
  );
  expect(api.getNodeById('nested')).toBeUndefined();
  expect(api.getNodeById('a')).toMatchObject({ parentId: 'parent', x: 40 });
  expect(entity().read(GlobalTransform).matrix.m20).toBe(90);
  expect([...api.getAppState().layersSelected].sort()).toEqual(['a', 'b']);
  await world.history(api, 'undo');
  expect(api.getNodeById('a')).toMatchObject({ parentId: 'nested', x: 10 });
  expect(entity().read(GlobalTransform).matrix.m20).toBe(90);
  expect(api.getAppState().layersSelected).toEqual(['nested']);
  await world.history(api, 'redo');
  expect(api.getNodeById('nested')).toBeUndefined();
  expect(api.getNodeById('b')).toMatchObject({ parentId: 'parent', x: 130 });
});
