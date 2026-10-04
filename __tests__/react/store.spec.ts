import type {
  CanvasSnapshot,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { createCanvasStore } from '../../packages/react/src/store';

it('isolates node snapshots and shares unchanged nodes across commits and refreshes', () => {
  let nodes: SerializedNode[] = [
    {
      id: 'rect',
      type: 'rect',
      zIndex: 0,
      width: 100,
      fills: [{ type: 'solid', value: 'red' }],
    },
    { id: 'other', type: 'rect', zIndex: 1, width: 50 },
  ];
  const appState = { layersSelected: [] };
  let notify!: (
    snapshot: CanvasSnapshot,
    changes: { nodesChanged: boolean; appStateChanged: boolean },
  ) => void;
  const api = {
    getNodes: () => nodes,
    getAppState: () => appState,
    getHistoryState: () => ({ canUndo: false, canRedo: false }),
    subscribe: (listener: typeof notify) => {
      notify = listener;
      return () => {};
    },
    subscribeHistory: () => () => {},
    onDestroy: (cleanup: () => void) => cleanup,
  } as unknown as ExtendedAPI;
  const store = createCanvasStore();
  const lease = store.claim();
  lease.attach(api, document.createElement('div'));
  const initial = store.getSnapshot();
  expect(initial.nodes).not.toBe(nodes);
  expect(initial.nodes[0]).not.toBe(nodes[0]);

  nodes[0].width = 120;
  nodes[0].fills![0].value = 'blue';
  nodes.push({ id: 'added', type: 'rect', zIndex: 2 });
  expect(initial.nodes).toHaveLength(2);
  expect(initial.nodes[0]).toMatchObject({
    width: 100,
    fills: [{ value: 'red' }],
  });

  notify({ nodes, appState } as CanvasSnapshot, {
    nodesChanged: true,
    appStateChanged: false,
  });
  const committed = store.getSnapshot();
  expect(committed.nodes).toHaveLength(3);
  expect(committed.nodes[0]).toMatchObject({
    width: 120,
    fills: [{ value: 'blue' }],
  });
  expect(committed.nodes[0]).not.toBe(initial.nodes[0]);
  expect(committed.nodes[1]).toBe(initial.nodes[1]);

  // Equivalent source objects and action refreshes keep the same list.
  nodes = structuredClone(nodes);
  store.refresh(api);
  expect(store.getSnapshot().nodes).toBe(committed.nodes);

  // View events cannot expose a document mutation before its commit.
  nodes[0].width = 140;
  notify({ nodes, appState } as CanvasSnapshot, {
    nodesChanged: false,
    appStateChanged: true,
  });
  expect(store.getSnapshot().nodes).toBe(committed.nodes);
  expect(committed.nodes[0].width).toBe(120);
  store.refresh(api);
  expect(store.getSnapshot().nodes[0].width).toBe(140);

  // Reordering changes the list, while preserving each unchanged node.
  const beforeReorder = store.getSnapshot().nodes;
  nodes = [nodes[1], nodes[0], nodes[2]];
  notify({ nodes, appState } as CanvasSnapshot, {
    nodesChanged: true,
    appStateChanged: false,
  });
  expect(store.getSnapshot().nodes).not.toBe(beforeReorder);
  expect(store.getSnapshot().nodes).toEqual([
    beforeReorder[1],
    beforeReorder[0],
    beforeReorder[2],
  ]);
  expect(store.getSnapshot().nodes[1]).toBe(beforeReorder[0]);

  // Removal retains the surviving node's identity and leaves old lists intact.
  nodes = [nodes[0]];
  notify({ nodes, appState } as CanvasSnapshot, {
    nodesChanged: true,
    appStateChanged: false,
  });
  expect(store.getSnapshot().nodes).toHaveLength(1);
  expect(store.getSnapshot().nodes[0]).toBe(initial.nodes[1]);
  expect(initial.nodes).toHaveLength(2);
  lease.release();
  expect(store.getSnapshot().nodes).toEqual([]);
});
