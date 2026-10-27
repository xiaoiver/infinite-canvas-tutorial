import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// The bridge has only type imports. Transpile it for the Node 20 tooling job,
// which runs before any browser packages or canvas bindings are built.
const source = fileURLToPath(
  new URL('../../packages/app/lib/webmcp/canvas-tools.ts', import.meta.url),
);
const output = ts.transpileModule(readFileSync(source, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const temp = mkdtempSync(join(tmpdir(), 'ic-webmcp-test-'));
const compiled = join(temp, 'canvas-tools.cjs');
writeFileSync(compiled, output);
const { registerCanvasWebMcp } = createRequire(import.meta.url)(compiled);
process.on('exit', () => rmSync(temp, { recursive: true, force: true }));

function setup() {
  const registered = new Map();
  const context = {
    async registerTool(tool, { signal }) {
      registered.set(tool.name, tool);
      signal.addEventListener('abort', () => registered.delete(tool.name), {
        once: true,
      });
    },
  };
  let nodes = [
    { id: 'base', type: 'rect', zIndex: 1, x: 0, y: 0, width: 10, height: 20 },
  ];
  const snapshots = [];
  const api = {
    getNodes: () => nodes,
    getAppState: () => ({ layersSelected: ['base'] }),
    exportCode: (_nodes, options) => `<div>${options.framework}</div>`,
    updateNode(node, patch) {
      nodes = patch
        ? nodes.map((current) =>
            current.id === node.id ? { ...current, ...patch } : current,
          )
        : [...nodes, node];
    },
    async edit(update, { signal } = {}) {
      if (signal?.aborted) return false;
      snapshots.push(structuredClone(nodes));
      update(this);
      return true;
    },
    undo() {
      nodes = snapshots.pop();
    },
  };
  return { api, context, registered };
}

test('registers project tools, uses undoable edits, validates inputs and cleans up', async () => {
  const { api, context, registered } = setup();
  const controller = new AbortController();
  assert.equal(
    await registerCanvasWebMcp(api, 'project-1', controller.signal, context),
    6,
  );
  assert.equal(registered.size, 6);
  assert.equal(
    JSON.parse(await registered.get('get_canvas_summary').execute({}))
      .nodeCount,
    1,
  );
  assert.equal(
    JSON.parse(await registered.get('get_selection').execute({})).nodes[0].id,
    'base',
  );
  assert.equal(
    JSON.parse(await registered.get('get_nodes').execute({ ids: ['base'] }))
      .nodes[0].width,
    10,
  );
  assert.match(
    JSON.parse(
      await registered
        .get('export_canvas_code')
        .execute({ framework: 'html-css' }),
    ).code,
    /html-css/,
  );
  assert.equal(registered.get('get_nodes').annotations.readOnlyHint, true);
  assert.equal(registered.get('create_shape').annotations.readOnlyHint, false);

  const created = JSON.parse(
    await registered
      .get('create_shape')
      .execute({
        type: 'rect',
        x: 2,
        y: 3,
        width: 30,
        height: 40,
        fill: '#abc',
      }),
  );
  assert.equal(api.getNodes().find((node) => node.id === created.id).zIndex, 2);
  await registered.get('update_node').execute({ id: created.id, width: 55 });
  assert.equal(api.getNodes().find((node) => node.id === created.id).width, 55);
  api.undo();
  assert.equal(api.getNodes().find((node) => node.id === created.id).width, 30);

  await assert.rejects(
    () => registered.get('update_node').execute({ id: 'base', locked: false }),
    /Unsupported field/,
  );
  await assert.rejects(
    () =>
      registered
        .get('create_shape')
        .execute({ type: 'rect', x: 0, y: 0, width: -1, height: 1 }),
    /width/,
  );
  const summary = registered.get('get_canvas_summary');
  controller.abort();
  assert.equal(registered.size, 0);
  await assert.rejects(() => summary.execute({}), /no longer available/);
});

test('leaves browsers without WebMCP and destroyed canvases untouched', async () => {
  const { api, context, registered } = setup();
  const controller = new AbortController();
  assert.equal(
    await registerCanvasWebMcp(api, 'project-1', controller.signal),
    0,
  );
  controller.abort();
  assert.equal(
    await registerCanvasWebMcp(api, 'project-1', controller.signal, context),
    0,
  );
  assert.equal(registered.size, 0);
});
