import {
  API,
  EdgeLabel,
  Path,
  Text,
  Transform,
  type PathSerializedNode,
  type RectSerializedNode,
} from '../../packages/ecs/src';
import { normalizePathCommands } from '../../packages/ecs/src/utils/path-edit';
import { createDocumentWorld } from '../helpers/ecs-document';
const rect = (id: string, x: number, y: number): RectSerializedNode => ({
  id,
  type: 'rect',
  zIndex: 0,
  x,
  y,
  width: 10,
  height: 10,
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

it('reloads a bound curve without replacing its edited control points', async () => {
  const curve: PathSerializedNode = {
    id: 'edge',
    type: 'path',
    zIndex: 0,
    d: 'M0 0 Q50 50 100 0',
    x: 0,
    y: 0,
    width: 100,
    height: 25,
    fromId: 'from',
    toId: 'to',
    exitX: 1,
    exitY: 0.5,
    entryX: 0,
    entryY: 0.5,
  };
  await world.reset(api, [curve, rect('to', 100, -5), rect('from', -10, -5)]);
  await world.frame();
  expect(api.getEntity(api.getNodeById('edge')).read(Path).d).toContain('Q');
  const reloaded = world.apis[1];
  await world.reset(reloaded, structuredClone(api.getNodes()));
  await world.frame();
  expect(reloaded.getEntity(reloaded.getNodeById('edge')).read(Path).d).toBe(
    api.getEntity(api.getNodeById('edge')).read(Path).d,
  );
});

const anchor = (editor: API, id = 'label') => {
  const entity = editor.getEntity(editor.getNodeById(id));
  const text = entity.read(Text);
  const transform = entity.read(Transform);
  return [
    transform.translation.x + text.anchorX,
    transform.translation.y + text.anchorY,
  ];
};
const label = (position: number, offset = 0) => ({
  id: 'label',
  type: 'text' as const,
  parentId: 'edge',
  zIndex: 1,
  content: 'Edge label',
  fontSize: 12,
  fontFamily: 'sans-serif',
  textAlign: 'center' as const,
  textBaseline: 'middle' as const,
  edgeLabelPosition: position,
  edgeLabelOffset: offset,
});

it.each([
  'line',
  'rough-line',
  'polyline',
  'rough-polyline',
  'path',
  'rough-path',
] as const)(
  'lays out %s labels when children arrive before their parent',
  async (type) => {
    await world.reset(api, [
      label(0.25, 8),
      {
        id: 'edge',
        type,
        zIndex: 0,
        x: 0,
        y: 0,
        width: 100,
        height: 0,
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
        points: '0,0 100,0',
        d: 'M0 0 L100 0',
        sourcePoint: { x: 0, y: 0 },
        targetPoint: { x: 100, y: 0 },
      },
    ]);
    await world.frame();
    expect(anchor(api)[0]).toBeCloseTo(25);
    expect(anchor(api)[1]).toBeCloseTo(8);
    await world.reset(world.apis[1], structuredClone(api.getNodes()));
    await world.frame();
    expect(anchor(world.apis[1])).toEqual(anchor(api));
  },
);

it.each([-1, 0, 0.5, 1, 2])(
  'clamps label position %s and applies the signed normal offset',
  async (position) => {
    await world.reset(api, [
      label(position, -10),
      {
        id: 'edge',
        type: 'line',
        zIndex: 0,
        x: 0,
        y: 0,
        width: 0,
        height: 100,
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 100,
        sourcePoint: { x: 0, y: 0 },
        targetPoint: { x: 0, y: 100 },
      },
    ]);
    await world.frame();
    expect(anchor(api)[0]).toBeCloseTo(10);
    expect(anchor(api)[1]).toBeCloseTo(
      Math.max(0, Math.min(1, position)) * 100,
    );
  },
);

it('updates a bound label through endpoint movement, undo, redo and reload', async () => {
  await world.reset(api, [
    label(0.5, 8),
    {
      id: 'edge',
      type: 'line',
      zIndex: 0,
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      fromId: 'from',
      toId: 'to',
      exitX: 1,
      exitY: 0.5,
      entryX: 0,
      entryY: 0.5,
    },
    rect('from', -10, -5),
    rect('to', 100, -5),
  ]);
  await world.frame();
  expect(anchor(api)[0]).toBeCloseTo(50);
  expect(anchor(api)[1]).toBeCloseTo(8);
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('to'), { x: 140 }),
  );
  await world.frame();
  expect(anchor(api)[0]).toBeCloseTo(70);
  expect(anchor(api)[1]).toBeCloseTo(8);
  await world.history(api, 'undo');
  await world.frame();
  expect(anchor(api)[0]).toBeCloseTo(50);
  await world.history(api, 'redo');
  await world.frame();
  expect(anchor(api)[0]).toBeCloseTo(70);
  await world.reset(world.apis[1], structuredClone(api.getNodes()));
  await world.frame();
  expect(anchor(world.apis[1])).toEqual(anchor(api));
});

it('uses the saved quadratic chord for labels without discarding the curve', async () => {
  await world.reset(api, [
    label(0.5, 8),
    {
      id: 'edge',
      type: 'path',
      zIndex: 0,
      d: 'M0 0 Q50 50 100 0',
      x: 0,
      y: 0,
      width: 100,
      height: 25,
      fromId: 'from',
      toId: 'to',
      exitX: 1,
      exitY: 0.5,
      entryX: 0,
      entryY: 0.5,
    },
    rect('from', -10, -5),
    rect('to', 100, -5),
  ]);
  await world.frame();
  expect(anchor(api)[0]).toBeCloseTo(50);
  expect(anchor(api)[1]).toBeCloseTo(8);
  expect(api.getEntity(api.getNodeById('edge')).read(Path).d).toContain('Q');
});

it.each(['M0 0 Q50 50 100 0', 'M0 0 C20 40 80 40 100 0'])(
  'preserves edited curve %s through moving both nodes, undo and reload',
  async (d) => {
    await world.reset(api, [
      {
        id: 'edge',
        type: 'path',
        zIndex: 0,
        d,
        x: 0,
        y: 0,
        width: 100,
        height: 30,
        fromId: 'from',
        toId: 'to',
        exitX: 1,
        exitY: 0.5,
        entryX: 0,
        entryY: 0.5,
      },
      rect('from', -10, -5),
      rect('to', 100, -5),
    ]);
    await world.frame();
    const commands = (editor: API) => {
      const entity = editor.getEntity(editor.getNodeById('edge'));
      const { translation } = entity.read(Transform);
      return normalizePathCommands(entity.read(Path).d).map((c) => [
        c[0],
        ...c
          .slice(1)
          .map(
            (v, i) =>
              (v as number) + (i % 2 === 0 ? translation.x : translation.y),
          ),
      ]);
    };
    const before = commands(api);
    await world.edit(api, (editor) => {
      editor.updateNode(editor.getNodeById('from'), { x: 0, y: 15 });
      editor.updateNode(editor.getNodeById('to'), { x: 110, y: 15 });
    });
    await world.frame();
    const expected = before.map((c) => [
      c[0],
      ...c.slice(1).map((v, i) => (v as number) + (i % 2 === 0 ? 10 : 20)),
    ]);
    expect(commands(api)).toEqual(expected);
    await world.history(api, 'undo');
    await world.frame();
    expect(commands(api)).toEqual(before);
    await world.history(api, 'redo');
    await world.frame();
    expect(commands(api)).toEqual(expected);
    await world.reset(world.apis[1], structuredClone(api.getNodes()));
    await world.frame();
    expect(commands(world.apis[1])).toEqual(expected);
  },
);

it('edits label position/offset and can detach and restore its automatic placement', async () => {
  await world.reset(api, [
    label(0.5, 8),
    {
      id: 'edge',
      type: 'line',
      zIndex: 0,
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      fromId: 'from',
      toId: 'to',
      exitX: 1,
      exitY: 0.5,
      entryX: 0,
      entryY: 0.5,
    },
    rect('from', -10, -5),
    rect('to', 100, -5),
  ]);
  await world.frame();
  const original = anchor(api);
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('label'), {
      edgeLabelPosition: 0.75,
      edgeLabelOffset: -4,
    }),
  );
  await world.frame();
  expect(anchor(api)[0]).toBeCloseTo(75);
  expect(anchor(api)[1]).toBeCloseTo(-4);
  const e = api.getEntity(api.getNodeById('label'));
  expect(e.read(EdgeLabel)).toMatchObject({
    labelPosition: 0.75,
    labelOffset: -4,
  });
  await world.history(api, 'undo');
  await world.frame();
  expect(anchor(api)).toEqual(original);
  await world.history(api, 'redo');
  await world.frame();
  expect(anchor(api)[0]).toBeCloseTo(75);
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('label'), {
      edgeLabelOffset: undefined,
    }),
  );
  await world.frame();
  expect(anchor(api)[1]).toBeCloseTo(0);
  await world.edit(api, (editor) =>
    editor.updateNode(editor.getNodeById('label'), {
      edgeLabelPosition: undefined,
    }),
  );
  await world.frame();
  expect(e.has(EdgeLabel)).toBe(false);
  await world.history(api, 'undo');
  await world.frame();
  expect(e.read(EdgeLabel).labelPosition).toBeCloseTo(0.75);
});
