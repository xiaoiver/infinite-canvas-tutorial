import {
  registerCanvasWebMcp,
  type ModelContext,
} from '../../packages/app/lib/webmcp/canvas-tools';
import type { API, SerializedNode } from '../../packages/ecs/src';

function setup() {
  const registered = new Map<string, any>();
  const context: ModelContext = {
    async registerTool(tool, { signal }) {
      registered.set(tool.name, tool);
      signal.addEventListener('abort', () => registered.delete(tool.name), {
        once: true,
      });
    },
  };
  let nodes = [
    { id: 'base', type: 'rect', zIndex: 1, x: 0, y: 0, width: 10, height: 20 },
  ] as SerializedNode[];
  const snapshots: SerializedNode[][] = [];
  const api = {
    getNodes: () => nodes,
    getAppState: () => ({ layersSelected: ['base'] }),
    exportCode: (_nodes: unknown, options: { framework: string }) =>
      `<div>${options.framework}</div>`,
    updateNode(node: SerializedNode, patch?: Partial<SerializedNode>) {
      nodes = patch
        ? nodes.map((current) =>
            current.id === node.id
              ? ({ ...current, ...patch } as SerializedNode)
              : current,
          )
        : [...nodes, node];
    },
    async edit(
      update: (editor: typeof api) => void,
      { signal }: { signal?: AbortSignal } = {},
    ) {
      if (signal?.aborted) return false;
      snapshots.push(structuredClone(nodes));
      update(this);
      return true;
    },
    undo() {
      nodes = snapshots.pop()!;
    },
  };
  return {
    api: api as unknown as API,
    context,
    registered,
    undo: () => api.undo(),
  };
}

it('registers project tools, uses undoable edits, validates inputs and cleans up', async () => {
  const { api, context, registered, undo } = setup();
  const controller = new AbortController();
  expect(
    await registerCanvasWebMcp(api, 'project-1', controller.signal, context),
  ).toBe(6);
  expect(registered.size).toBe(6);
  expect(
    JSON.parse(await registered.get('get_canvas_summary').execute({}))
      .nodeCount,
  ).toBe(1);
  expect(
    JSON.parse(await registered.get('get_selection').execute({})).nodes[0].id,
  ).toBe('base');
  expect(
    JSON.parse(await registered.get('get_nodes').execute({ ids: ['base'] }))
      .nodes[0].width,
  ).toBe(10);
  expect(
    JSON.parse(
      await registered
        .get('export_canvas_code')
        .execute({ framework: 'html-css' }),
    ).code,
  ).toContain('html-css');
  expect(registered.get('get_nodes').annotations.readOnlyHint).toBe(true);
  expect(registered.get('create_shape').annotations.readOnlyHint).toBe(false);

  const created = JSON.parse(
    await registered.get('create_shape').execute({
      type: 'rect',
      x: 2,
      y: 3,
      width: 30,
      height: 40,
      fill: '#abc',
    }),
  );
  expect(api.getNodes().find((node) => node.id === created.id)?.zIndex).toBe(2);
  await registered.get('update_node').execute({ id: created.id, width: 55 });
  expect(api.getNodes().find((node) => node.id === created.id)?.width).toBe(55);
  undo();
  expect(api.getNodes().find((node) => node.id === created.id)?.width).toBe(30);

  await expect(
    registered.get('update_node').execute({ id: 'base', locked: false }),
  ).rejects.toThrow('Unsupported field');
  await expect(
    registered
      .get('create_shape')
      .execute({ type: 'rect', x: 0, y: 0, width: -1, height: 1 }),
  ).rejects.toThrow('width');
  const summary = registered.get('get_canvas_summary');
  controller.abort();
  expect(registered.size).toBe(0);
  await expect(summary.execute({})).rejects.toThrow('no longer available');
});

it('leaves browsers without WebMCP and destroyed canvases untouched', async () => {
  const { api, context, registered } = setup();
  const controller = new AbortController();
  expect(await registerCanvasWebMcp(api, 'project-1', controller.signal)).toBe(
    0,
  );
  controller.abort();
  expect(
    await registerCanvasWebMcp(api, 'project-1', controller.signal, context),
  ).toBe(0);
  expect(registered.size).toBe(0);
});
