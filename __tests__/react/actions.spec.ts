import type { AppState, SerializedNode } from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { ResourceScope } from '../../packages/ecs/src/resources/ResourceScope';
import { TaskQueue } from '../../packages/ecs/src/TaskQueue';
import { createCanvasActions } from '../../packages/react/src/actions';
import { createCanvasStore } from '../../packages/react/src/store';

const rectangle = (width = 100): SerializedNode => ({
  id: 'rect',
  type: 'rect',
  zIndex: 0,
  width,
  height: 80,
});

function mount(store = createCanvasStore()) {
  const queue = new TaskQueue();
  const scope = new ResourceScope();
  let nodes: SerializedNode[] = [rectangle()];
  let state = {
    filter: '',
    cameraZoom: 1,
    penbarVisible: true,
    layersSelected: [],
  } as unknown as AppState;
  const api = {
    getNodes: () => nodes,
    getNodeById: (id: string) => nodes.find((node) => node.id === id),
    getAppState: () => state,
    getHistoryState: () => ({ canUndo: false, canRedo: false }),
    subscribe: () => () => {},
    subscribeHistory: () => () => {},
    onDestroy: (cleanup: () => void) => scope.add(cleanup),
    runAtNextTick: (task: () => void) => queue.add(task),
    updateNodes: jest.fn((updates: SerializedNode[]) => {
      const next = new Map(nodes.map((node) => [node.id, node]));
      updates.forEach((node) => next.set(node.id, node));
      nodes = [...next.values()];
    }),
    setAppState: jest.fn((patch: Partial<AppState>) => {
      state = { ...state, ...patch };
    }),
    selectNodes: jest.fn((selected: SerializedNode[], preserve: boolean) => {
      state = {
        ...state,
        layersSelected: [
          ...new Set([
            ...(preserve ? state.layersSelected : []),
            ...selected.map((node) => node.id),
          ]),
        ],
      };
    }),
    record: jest.fn(),
    undo: jest.fn(),
    redo: jest.fn(),
    clearHistory: jest.fn(),
    destroy() {
      queue.dispose();
      scope.dispose();
    },
  };
  const lease = store.claim();
  lease.attach(api as unknown as ExtendedAPI, document.createElement('div'));
  return {
    store,
    api,
    lease,
    flush: () => queue.flush(),
    actions: createCanvasActions(store),
  };
}

it('composes queued functional node updates from the latest scene', async () => {
  const { api, store, flush, actions } = mount();
  const original = api.getNodes()[0];
  const first = actions.updateNodes((nodes) =>
    nodes.map((node) => ({ ...node, width: node.width! + 10 })),
  );
  const second = actions.updateNodes((nodes) =>
    nodes.map((node) => ({ ...node, width: node.width! + 10 })),
  );
  expect(api.updateNodes).not.toHaveBeenCalled();
  flush();
  expect(await Promise.all([first, second])).toEqual([true, true]);
  expect(store.getSnapshot().nodes[0].width).toBe(120);
  expect(original.width).toBe(100);
  expect(api.record.mock.calls).toEqual([['IMMEDIATELY'], ['IMMEDIATELY']]);
  api.destroy();
});

it('copies supplied nodes before queueing and preserves omitted nodes', async () => {
  const { api, flush, actions } = mount();
  const supplied = { ...rectangle(60), id: 'second' };
  const edit = actions.updateNodes([supplied]);
  supplied.width = 999;
  flush();
  expect(await edit).toBe(true);
  expect(api.getNodes().map((node) => [node.id, node.width])).toEqual([
    ['rect', 100],
    ['second', 60],
  ]);
  api.destroy();
});

it('refreshes non-history view settings and composes application state patches', async () => {
  const { api, store, flush, actions } = mount();
  const hidden = actions.setAppState(
    { penbarVisible: false },
    { capture: 'NEVER' },
  );
  const first = actions.setAppState((state) => ({
    filter: `${state.filter}a`,
  }));
  const second = actions.setAppState((state) => ({
    filter: `${state.filter}b`,
  }));
  flush();
  expect(await Promise.all([hidden, first, second])).toEqual([
    true,
    true,
    true,
  ]);
  expect(store.getSnapshot().appState).toMatchObject({
    penbarVisible: false,
    filter: 'ab',
  });
  expect(api.setAppState).toHaveBeenNthCalledWith(
    1,
    { penbarVisible: false },
    { recordDesignVariableUndo: false },
  );
  expect(api.record.mock.calls).toEqual([
    ['NEVER'],
    ['IMMEDIATELY'],
    ['IMMEDIATELY'],
  ]);
  api.destroy();
});

it('commits a compound synchronous edit once and exposes its complete state', async () => {
  const { api, store, flush, actions } = mount();
  const edit = actions.edit((api) => {
    api.updateNodes([rectangle(150)]);
    api.selectNodes([api.getNodeById('rect')!]);
  });
  flush();
  expect(await edit).toBe(true);
  expect(api.record).toHaveBeenCalledTimes(1);
  expect(store.getSnapshot().nodes[0].width).toBe(150);
  expect(store.getSnapshot().appState!.layersSelected).toEqual(['rect']);
  api.destroy();
});

it('resolves selection IDs at execution and ignores missing or deleted nodes', async () => {
  const { api, flush, actions } = mount();
  const inserted = actions.updateNodes([
    { ...rectangle(), id: 'new' },
    { ...rectangle(), id: 'deleted', isDeleted: true },
  ]);
  const ids = ['new', 'missing', 'deleted'];
  const selected = actions.selectNodes(ids, { preserveSelection: true });
  ids.length = 0;
  flush();
  expect(await Promise.all([inserted, selected])).toEqual([true, true]);
  expect(api.selectNodes).toHaveBeenCalledWith(
    [expect.objectContaining({ id: 'new' })],
    true,
  );
  expect(api.getAppState().layersSelected).toEqual(['new']);
  api.destroy();
});

it('settles dropped edits on destruction and routes retained actions to a new owner', async () => {
  const first = mount();
  const pending = first.actions.updateNodes([rectangle(150)]);
  first.lease.release();
  first.api.destroy();
  expect(await pending).toBe(false);
  expect(first.api.updateNodes).not.toHaveBeenCalled();
  const second = mount(first.store);
  const next = first.actions.updateNodes([rectangle(200)]);
  second.flush();
  expect(await next).toBe(true);
  expect(second.api.getNodes()[0].width).toBe(200);
  expect(first.api.updateNodes).not.toHaveBeenCalled();
  second.api.destroy();
});

it('skips edits when the Provider is empty or ownership changes before the tick', async () => {
  const store = createCanvasStore();
  const actions = createCanvasActions(store);
  const mutate = jest.fn();
  expect(await actions.edit(mutate)).toBe(false);
  expect(actions.undo()).toBe(false);
  expect(actions.redo()).toBe(false);
  expect(actions.clearHistory()).toBe(false);
  const first = mount(store);
  const pending = actions.edit(mutate);
  first.lease.release();
  const second = mount(store);
  first.flush();
  expect(await pending).toBe(false);
  expect(mutate).not.toHaveBeenCalled();
  expect(actions.undo()).toBe(true);
  expect(actions.redo()).toBe(true);
  expect(actions.clearHistory()).toBe(true);
  expect(second.api.undo).toHaveBeenCalledTimes(1);
  expect(second.api.redo).toHaveBeenCalledTimes(1);
  expect(second.api.clearHistory).toHaveBeenCalledTimes(1);
  first.api.destroy();
  second.api.destroy();
});

it('rejects failed or asynchronous mutators while allowing subsequent queued edits', async () => {
  const { api, flush, actions } = mount();
  const failed = actions.edit(() => {
    throw new Error('invalid edit');
  });
  const asynchronous = actions.edit(async () => {
    throw new Error('async edit');
  });
  const next = actions.updateNodes([rectangle(140)]);
  const failedCheck = expect(failed).rejects.toThrow('invalid edit');
  const asyncCheck = expect(asynchronous).rejects.toThrow(
    'must be synchronous',
  );
  expect(flush).not.toThrow();
  await Promise.all([failedCheck, asyncCheck]);
  expect(await next).toBe(true);
  expect(api.record).toHaveBeenCalledTimes(1);
  expect(api.getNodes()[0].width).toBe(140);
  api.destroy();
});
