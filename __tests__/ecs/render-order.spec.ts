import {
  GlobalRenderOrder,
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
class ObserveOrders extends System {
  orders = this.query(
    (q) => q.addedOrChanged.with(GlobalRenderOrder).trackWrites,
  );
  execute() {
    changes.push(...this.orders.addedOrChanged.map((e) => e.__id));
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
  changes = [];
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
  await world.history(api, 'undo');
  await world.history(api, 'redo');
  await world.edit(api, (e) => e.setAppState({ cameraX: 10, cameraZoom: 0.5 }));
  expect(order()).toEqual(before);
  expect(changes).toEqual([]);
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
