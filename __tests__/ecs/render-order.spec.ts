import {
  ComputeZIndex,
  Flex,
  GlobalRenderOrder,
  ZIndex,
  FractionalIndex,
  Children,
  Sort,
  Last,
  System,
  system,
  type API,
  type SerializedNode,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';

// Observe the same real Becsy write events used by MeshPipeline, without a GPU.
let changes: number[] = [];
let zWrites: number[] = [];
let keyWrites: number[] = [];
const clearSignals = () => {
  changes = [];
  zWrites = [];
  keyWrites = [];
};
class ObserveOrders extends System {
  orders = this.query(
    (q) => q.addedOrChanged.with(GlobalRenderOrder).trackWrites,
  );
  z = this.query((q) => q.changed.with(ZIndex).trackWrites);
  keys = this.query((q) => q.addedOrChanged.with(FractionalIndex).trackWrites);
  execute() {
    zWrites.push(...this.z.changed.map((e) => e.__id));
    keyWrites.push(...this.keys.addedOrChanged.map((e) => e.__id));
    changes.push(...this.orders.addedOrChanged.map((e) => e.__id));
  }
}
// Keep the existing ZIndex/Flex mutation footprint, without generated-key access.
let limitedOrderEdit: (() => void) | undefined;
class LimitedOrderEdits extends System {
  access = this.query((q) => q.using(ZIndex).write.and.using(Flex).read);
  execute() {
    const edit = limitedOrderEdit;
    limitedOrderEdit = undefined;
    edit?.();
  }
}
let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
const rect = (
  id: string,
  zIndex: number,
  parentId?: string,
): SerializedNode => ({
  id,
  type: 'rect',
  zIndex,
  parentId,
  x: 0,
  y: 0,
  width: 20,
  height: 20,
  fills: [{ type: 'solid', value: 'blue' }],
});
function order(ids = ['a', 'b', 'c', 'd']) {
  return [...ids].sort(
    (a, b) =>
      api.getEntity(api.getNodeById(a)).read(GlobalRenderOrder).value -
      api.getEntity(api.getNodeById(b)).read(GlobalRenderOrder).value,
  );
}
beforeAll(async () => {
  world = await createDocumentWorld(2, false, [
    () => {
      system((s) => s.inAnyOrderWith(s.allSystems).after(Sort).before(Last))(
        ObserveOrders,
      );
      system((s) => s.inAnyOrderWith(s.allSystems).before(ComputeZIndex))(
        LimitedOrderEdits,
      );
    },
  ]);
  [api] = world.apis;
});
afterAll(async () => {
  await world?.dispose();
});
beforeEach(async () => {
  await world.reset(
    api,
    ['a', 'b', 'c', 'd'].map((id, i) => rect(id, i)),
  );
  await world.reset(world.apis[1], [rect('other', 0)]);
  await world.frame();
  clearSignals();
});
it('does not broadcast unchanged ranks for full-node paint edits, history or camera motion', async () => {
  const before = order();
  await world.edit(api, (e) =>
    e.updateNodes([
      { ...e.getNodeById('b'), fills: [{ type: 'solid', value: 'red' }] },
    ]),
  );
  expect(order()).toEqual(before);
  expect(changes).toEqual([]);
  expect(zWrites).toEqual([]);
  expect(keyWrites).toEqual([]);
  await world.history(api, 'undo');
  await world.history(api, 'redo');
  await world.edit(api, (e) => e.setAppState({ cameraX: 10, cameraZoom: 0.5 }));
  expect(order()).toEqual(before);
  expect(changes).toEqual([]);
  expect(zWrites).toEqual([]);
  expect(keyWrites).toEqual([]);
});
it('publishes real batched rank changes through undo and redo', async () => {
  await world.edit(api, (e) => {
    e.sendToBack(e.getNodeById('b'));
    e.sendToBack(e.getNodeById('c'));
  });
  expect(order()).toEqual(['c', 'b', 'a', 'd']);
  expect(changes.length).toBeGreaterThan(0);
  changes = [];
  await world.history(api, 'undo');
  expect(order()).toEqual(['a', 'b', 'c', 'd']);
  expect(changes.length).toBeGreaterThan(0);
  changes = [];
  await world.history(api, 'redo');
  expect(order()).toEqual(['c', 'b', 'a', 'd']);
  expect(changes.length).toBeGreaterThan(0);
});
it('renumbers after same-frame deletion and insertion and moves nested descendants', async () => {
  const old = api.getEntity(api.getNodeById('a')).__id;
  await world.edit(api, (e) => {
    e.deleteNodesById(['a']);
    e.updateNodes([rect('new', 2.5)]);
  });
  expect(order(['new', 'b', 'c', 'd'])).toEqual(['b', 'c', 'new', 'd']);
  expect(changes).not.toContain(old);
  expect(changes.length).toBeGreaterThan(0);
  await world.edit(api, (e) =>
    e.updateNodes([
      { id: 'g', type: 'g', zIndex: 5 },
      { id: 'nested', type: 'g', parentId: 'g', zIndex: 0 },
      rect('leaf', 0, 'nested'),
      rect('front', 6),
    ]),
  );
  const ids = ['g', 'nested', 'leaf', 'front'];
  expect(order(ids)).toEqual(ids);
  changes = [];
  await world.edit(api, (e) => e.bringToFront(e.getNodeById('g')));
  expect(order(ids)).toEqual(['front', 'g', 'nested', 'leaf']);
  expect(changes).toContain(api.getEntity(api.getNodeById('leaf')).__id);
  await world.history(api, 'undo');
  expect(order(ids)).toEqual(ids);
});

it('compares the stored Float32 rank while preserving exact document values and default resets', async () => {
  await world.reset(api, [
    rect('a', 0),
    rect('b', 0.1),
    rect('c', 2),
    rect('d', 3),
  ]);
  await world.frame();
  clearSignals();
  const entity = api.getEntity(api.getNodeById('b'));
  expect(entity.read(ZIndex).value).toBe(Math.fround(0.1));
  await world.edit(api, (e) =>
    e.updateNodes([
      { ...e.getNodeById('b'), fills: [{ type: 'solid', value: 'red' }] },
    ]),
  );
  expect(zWrites).toEqual([]);
  expect(keyWrites).toEqual([]);
  const close = 0.1 + 1e-10;
  await world.edit(api, (e) =>
    e.updateNode(e.getNodeById('b'), { zIndex: close }),
  );
  expect(api.getNodeById('b').zIndex).toBe(close);
  expect(entity.read(ZIndex).value).toBe(Math.fround(close));
  expect(zWrites).toEqual([]);
  await world.history(api, 'undo');
  expect(api.getNodeById('b').zIndex).toBe(0.1);
  expect(zWrites).toEqual([]);
  await world.edit(api, (e) =>
    e.updateNode(e.getNodeById('a'), { zIndex: undefined, opacity: 0.4 }),
  );
  expect(api.getEntity(api.getNodeById('a')).read(ZIndex).value).toBe(0);
  expect(zWrites).toEqual([]);
  await world.edit(api, (e) => e.updateNode(e.getNodeById('b'), { zIndex: 4 }));
  expect(order()).toEqual(['a', 'c', 'd', 'b']);
  expect(zWrites).toContain(entity.__id);
});

it('still reconciles equal ranks on reparenting, undo/redo and remote paint replay', async () => {
  const initial: SerializedNode[] = [
    { id: 'left', type: 'g', zIndex: 0 },
    rect('a', 0, 'left'),
    { id: 'right', type: 'g', zIndex: 10 },
    rect('b', 1, 'right'),
  ];
  await world.reset(api, initial);
  await world.frame();
  clearSignals();
  const ids = ['left', 'a', 'right', 'b'];
  await world.edit(api, (e) =>
    e.updateNodes([{ ...e.getNodeById('a'), parentId: 'right' }]),
  );
  expect(order(ids)).toEqual(['left', 'right', 'a', 'b']);
  expect(zWrites).toContain(api.getEntity(api.getNodeById('a')).__id);
  expect(
    api.getNodeByEntity(
      api.getEntity(api.getNodeById('a')).read(Children).parent,
    ).id,
  ).toBe('right');
  await world.history(api, 'undo');
  expect(order(ids)).toEqual(ids);
  await world.history(api, 'redo');
  expect(order(ids)).toEqual(['left', 'right', 'a', 'b']);
  clearSignals();
  await world.edit(
    api,
    (e) =>
      e.replaceDocument(
        e
          .getNodes()
          .map((n) =>
            n.id === 'a'
              ? { ...n, fills: [{ type: 'solid', value: 'green' }] }
              : n,
          ),
        'remote',
      ),
    'NEVER',
  );
  expect(order(ids)).toEqual(['left', 'right', 'a', 'b']);
  expect(zWrites).toEqual([]);
  expect(keyWrites).toEqual([]);
});

it.each(['missing', 'explicit'] as const)(
  'retains reconciliation for %s fractional-key state',
  async (kind) => {
    const entity = api.getEntity(api.getNodeById('b'));
    const key = entity.read(FractionalIndex).value;
    await world.edit(api, (e) => {
      if (kind === 'missing') entity.remove(FractionalIndex);
      e.updateNodes([
        {
          ...e.getNodeById('b'),
          ...(kind === 'explicit' ? { fractionalIndex: key } : {}),
          opacity: 0.4,
        },
      ]);
    });
    expect(entity.has(FractionalIndex)).toBe(true);
    expect(order()).toEqual(['a', 'b', 'c', 'd']);
    if (kind === 'explicit') expect(zWrites).toContain(entity.__id);
    else expect(zWrites).toEqual([]);
    expect(keyWrites).toContain(entity.__id);
  },
);

it('keeps migrated-camera order and document paint when the payload omits parentId', async () => {
  const secondary = world.apis[1];
  expect(secondary.getCamera().isSame(api.getCamera())).toBe(false);
  await world.reset(api, [rect('mover', 2)]);
  await world.reset(secondary, [
    rect('target-back', 0),
    rect('target-front', 1),
  ]);
  await world.frame();
  const entity = api.getEntity(api.getNodeById('mover'));
  await world.edit(api, () => {
    entity.write(Children).parent = secondary.getCamera();
  });
  const before = entity.read(GlobalRenderOrder).value;
  const patch = { ...api.getNodeById('mover') };
  delete patch.parentId;
  await world.edit(api, (e) =>
    e.updateNodes([{ ...patch, fills: [{ type: 'solid', value: 'red' }] }]),
  );
  expect(entity.read(Children).parent.isSame(secondary.getCamera())).toBe(true);
  expect(entity.read(GlobalRenderOrder).value).toBe(before);
  expect(entity.read(GlobalRenderOrder).value).toBeGreaterThan(
    secondary
      .getEntity(secondary.getNodeById('target-front'))
      .read(GlobalRenderOrder).value,
  );
  expect(api.getNodeById('mover').zIndex).toBe(2);
  expect(api.getNodeById('mover').fills).toEqual([
    { type: 'solid', value: 'red' },
  ]);
});

it('allows rank-only plugins to change and repeat a rank without fractional-key access', async () => {
  for (const rank of [4, 4, 1]) {
    clearSignals();
    const node = api.getNodeById('b');
    const previous = api.getEntity(node).read(ZIndex).value;
    limitedOrderEdit = () => api.updateNode(node, { zIndex: rank }, false);
    await world.frame();
    expect(api.getEntity(node).read(ZIndex).value).toBe(rank);
    expect(order()).toEqual(
      rank === 4 ? ['a', 'c', 'd', 'b'] : ['a', 'b', 'c', 'd'],
    );
    if (rank === previous) {
      expect(zWrites).toEqual([]);
      expect(keyWrites).toEqual([]);
      expect(changes).toEqual([]);
    } else {
      expect(zWrites).toContain(api.getEntity(node).__id);
      expect(keyWrites).toContain(api.getEntity(node).__id);
    }
  }
});

it('recovers a missing generated key without another document rank update', async () => {
  const entity = api.getEntity(api.getNodeById('b'));
  await world.edit(api, () => entity.remove(FractionalIndex));
  expect(entity.has(FractionalIndex)).toBe(true);
  expect(order()).toEqual(['a', 'b', 'c', 'd']);
  expect(zWrites).toEqual([]);
  expect(keyWrites).toContain(entity.__id);
});
