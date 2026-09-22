import type { API, SerializedNode } from '@infinite-canvas-tutorial/ecs';
import deepEqual from 'deep-equal';

export interface NodePatch {
  id: string;
  remove?: boolean;
  set?: Record<string, unknown>;
  unset?: string[];
}

/** Compare with the last canvas snapshot, not the current CRDT (which may have unseen remote edits). */
export function diffNodes(
  previous: readonly SerializedNode[],
  next: readonly SerializedNode[],
): NodePatch[] {
  const before = new Map(
    previous.map((node, order) => [node.id, { ...node, __order: order }]),
  );
  const live = next.filter((node) => !node.isDeleted);
  const ids = new Set(live.map((node) => node.id));
  const patches: NodePatch[] = previous
    .filter((node) => !ids.has(node.id))
    .map(({ id }) => ({ id, remove: true }));
  live.forEach((node, order) => {
    const old = before.get(node.id) ?? {};
    const current = { ...node, __order: order };
    const set = Object.fromEntries(
      Object.entries(current).filter(
        ([key, value]) =>
          value !== undefined && !deepEqual(old[key], value, { strict: true }),
      ),
    );
    const unset = Object.keys(old).filter(
      (key) => old[key] !== undefined && current[key] === undefined,
    );
    if (Object.keys(set).length || unset.length)
      patches.push({ id: node.id, set, unset });
  });
  return patches;
}

export function orderedNodes(values: Record<string, any>[]): SerializedNode[] {
  const nodes = values
    .sort(
      (a, b) =>
        (a.__order ?? 0) - (b.__order ?? 0) ||
        String(a.id).localeCompare(String(b.id)),
    )
    .map(({ __order, ...node }) => node as SerializedNode)
    .filter((node) => !node.isDeleted);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Concurrent moves and parent deletion can create orphaned/cyclic links.
  // Project them deterministically as roots without discarding the shapes.
  for (const node of nodes) {
    const seen = new Set([node.id]);
    let parent = node.parentId;
    while (parent != null) {
      if (!byId.has(parent) || seen.has(parent)) {
        delete node.parentId;
        break;
      }
      seen.add(parent);
      parent = byId.get(parent).parentId;
    }
  }
  return nodes;
}

export interface DocumentAdapter {
  read(): SerializedNode[];
  write(
    previous: readonly SerializedNode[],
    next: readonly SerializedNode[],
  ): void;
  subscribe(refresh: () => void): () => void;
}

export function bindDocument(api: API, adapter: DocumentAdapter): () => void {
  let previous = structuredClone(api.getNodes());
  let scheduled = false;
  let disposed = false;
  const refresh = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    api.runAtNextTick(() => {
      scheduled = false;
      if (disposed) return;
      // Read at execution time so queued remote updates and intervening local edits are merged.
      api.replaceDocument(adapter.read(), 'remote');
      previous = structuredClone(api.getNodes());
    });
  };
  const oldOnChange = api.onchange;
  const onChange: API['onchange'] = (snapshot) => {
    adapter.write(previous, snapshot.nodes);
    previous = structuredClone(snapshot.nodes);
    refresh();
    oldOnChange?.(snapshot);
  };
  api.onchange = onChange;
  const unsubscribe = adapter.subscribe(refresh);
  refresh(); // Includes updates received before the canvas READY event.
  return () => {
    disposed = true;
    unsubscribe();
    if (api.onchange === onChange) api.onchange = oldOnChange;
  };
}

/** Fixed demo content, shared by all replicas of the initial document. */
export const demoNodes: SerializedNode[] = [
  {
    id: '0',
    type: 'rect',
    fill: 'red',
    stroke: 'black',
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  },
];
