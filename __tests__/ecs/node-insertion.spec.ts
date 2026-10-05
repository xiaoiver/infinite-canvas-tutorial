import type { API, AppState, SerializedNode } from '../../packages/ecs/src';
import { EditQueue } from '../../packages/ecs/src/EditQueue';
import { TaskQueue } from '../../packages/ecs/src/TaskQueue';
import { updateAndSelectNodes } from '../../packages/webcomponents/src/utils/common';

function canvas() {
  const tasks = new TaskQueue();
  const edits = new EditQueue((task) => tasks.add(task));
  const nodes = new Map<string, SerializedNode>();
  let highlighted = ['old'];
  let selected = ['old'];
  const commit = jest.fn(() => ({ highlighted, selected }));
  const api = {
    edit: (update: (api: API) => void, options: { signal?: AbortSignal }) =>
      edits.add(() => update(api as unknown as API), commit, options.signal),
    updateNodes: jest.fn((received: SerializedNode[]) => {
      received.forEach((node) => nodes.set(node.id, node));
    }),
    getNodeById: (id: string) => nodes.get(id),
    getAppState: () => ({ layersHighlighted: highlighted }),
    getEntity: (node: SerializedNode) => nodes.has(node.id),
    unhighlightNodes: (received: SerializedNode[]) => {
      highlighted = highlighted.filter(
        (id) => !received.some((node) => node.id === id),
      );
    },
    setAppState: (state: { layersHighlighted: string[] }) => {
      highlighted = state.layersHighlighted;
    },
    selectNodes: (received: SerializedNode[]) => {
      selected = received.map((node) => node.id);
    },
  };
  return { api: api as unknown as API, tasks, edits, commit, nodes };
}
const legacyState = { layersHighlighted: ['stale'] } as AppState;
const rect = (): SerializedNode => ({
  id: 'inserted',
  type: 'rect',
  x: 10,
  y: 20,
  width: 80,
  height: 60,
  zIndex: 1,
});

it('owns queued input and resolves only after insertion and selection commit together', async () => {
  const { api, tasks, commit, nodes } = canvas();
  const input = rect();
  const pending = updateAndSelectNodes(api, legacyState, [input]);
  input.x = 999;
  let settled = false;
  void pending.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(nodes.size).toBe(0);
  tasks.flush();
  await expect(pending).resolves.toBe(true);
  expect(nodes.get('inserted')!.x).toBe(10);
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit.mock.results[0].value).toEqual({
    highlighted: [],
    selected: ['inserted'],
  });
});

it('makes empty, aborted, and destroyed insertions no-ops without history', async () => {
  const { api, tasks, edits, commit, nodes } = canvas();
  await expect(updateAndSelectNodes(api, legacyState, [])).resolves.toBe(false);
  const controller = new AbortController();
  const pending = updateAndSelectNodes(api, legacyState, [rect()], {
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).resolves.toBe(false);
  const destroyed = updateAndSelectNodes(api, legacyState, [rect()]);
  edits.dispose();
  await expect(destroyed).resolves.toBe(false);
  await expect(updateAndSelectNodes(api, legacyState, [rect()])).resolves.toBe(
    false,
  );
  tasks.flush();
  expect(nodes.size).toBe(0);
  expect(commit).not.toHaveBeenCalled();
});

it('propagates edit errors without recording or selecting', async () => {
  const { api, tasks, commit } = canvas();
  const failure = new Error('Insert failed');
  jest.mocked(api.updateNodes).mockImplementation(() => {
    throw failure;
  });
  const pending = updateAndSelectNodes(api, legacyState, [rect()]);
  const rejected = expect(pending).rejects.toBe(failure);
  tasks.flush();
  await rejected;
  expect(commit).not.toHaveBeenCalled();
});
