import { API, DefaultStateManagement } from '../../packages/ecs/src/API';
import { mutateElement } from '../../packages/ecs/src/history';
import { SerializedNode } from '../../packages/ecs/src/utils';

jest.mock('../../packages/ecs/src/history', () => ({
  ...jest.requireActual('../../packages/ecs/src/history'),
  mutateElement: jest.fn((_entity, node, diff) =>
    Object.assign(node, diff, { version: (node.version || 0) + 1 }),
  ),
}));

describe('API batch updates', () => {
  function createAPI() {
    const state = new DefaultStateManagement();
    const commands = { execute: jest.fn() };
    const api = new API(state, commands as any);
    const nodes: SerializedNode[] = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      type: 'rect',
      x: i,
    }));
    api.setNodes(nodes);
    nodes.forEach((node) =>
      api.getEntityCommands().set(node.id, { id: () => ({}) } as any),
    );
    return { api, state, nodes };
  }

  it('commits once for a bulk edit, preserving untouched nodes and ordering', () => {
    const { api, state, nodes } = createAPI();
    const commit = jest.spyOn(state, 'setNodes');
    const updates = nodes.slice(0, 100).map((node) => ({ ...node, x: 500 }));
    api.updateNodes(updates);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(api.getNodes()).toHaveLength(1000);
    expect(
      api
        .getNodes()
        .slice(0, 100)
        .every((node) => node.x === 500 && node.version === 1),
    ).toBe(true);
    expect(api.getNodes()[100]).toEqual(nodes[100]);
    expect(api.getNodes().map((node) => node.id)).toEqual(
      nodes.map((node) => node.id),
    );
    updates[0].x = -1;
    expect(api.getNodes()[0].x).toBe(500);
  });

  it('does not publish when state updates are explicitly disabled', () => {
    const { api, state } = createAPI();
    const commit = jest.spyOn(state, 'setNodes');
    (mutateElement as jest.Mock).mockClear();
    api.updateNodes([{ id: '0', type: 'rect', x: 500 }], false);
    expect(mutateElement).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    expect(api.getNodes()[0].x).toBe(0);
  });

  it('does not publish empty batches', () => {
    const { api, state } = createAPI();
    const commit = jest.spyOn(state, 'setNodes');
    api.updateNodes([]);
    expect(commit).not.toHaveBeenCalled();
  });
});
