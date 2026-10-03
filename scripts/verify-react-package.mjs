import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const consumer = mkdtempSync(join(tmpdir(), 'infinite-canvas-react-package-'));
const modules = join(consumer, 'node_modules');
const reactModules =
  process.env.REACT_TEST_MODULES || join(root, 'packages/react/node_modules');
const packages = [
  'device-api',
  'ecs',
  'plugin-filter',
  'plugin-figma',
  'plugin-mermaid',
  'webcomponents',
  'react',
];
const manifests = [];

function link(name, source) {
  const target = join(modules, name);
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(source, target, 'dir');
}

try {
  mkdirSync(modules);
  // Consume real pnpm tarballs, including rewritten workspace dependencies.
  for (const directory of packages) {
    const source = join(root, 'packages', directory);
    const manifest = JSON.parse(
      readFileSync(join(source, 'package.json'), 'utf8'),
    );
    const output = join(consumer, `pack-${directory}`);
    mkdirSync(output);
    execFileSync('pnpm', ['pack', '--pack-destination', output], {
      cwd: source,
      stdio: 'pipe',
    });
    const archive = readdirSync(output).find((name) => name.endsWith('.tgz'));
    assert(archive, `Missing tarball for ${manifest.name}`);
    const target = join(modules, manifest.name);
    mkdirSync(target, { recursive: true });
    execFileSync('tar', [
      '-xzf',
      join(output, archive),
      '-C',
      target,
      '--strip-components=1',
    ]);
    const packed = JSON.parse(
      readFileSync(join(target, 'package.json'), 'utf8'),
    );
    assert(
      !JSON.stringify(packed.dependencies).includes('workspace:'),
      'Unresolved workspace dependency',
    );
    manifests.push({ source, manifest });
  }
  // Reuse installed third-party dependencies; every workspace library above is
  // loaded from its tarball. React/types use the selected compatibility version.
  const linked = new Set(manifests.map(({ manifest }) => manifest.name));
  for (const name of [
    'react',
    'react-dom',
    '@types/react',
    '@types/react-dom',
  ]) {
    link(name, join(reactModules, name));
    linked.add(name);
  }
  for (const { source, manifest } of manifests) {
    for (const name of Object.keys({
      ...manifest.dependencies,
      ...manifest.peerDependencies,
    })) {
      if (linked.has(name)) continue;
      // Package exports can hide package.json; resolve the installed directory
      // directly from that workspace's node_modules instead.
      const candidate = join(source, 'node_modules', name);
      assert(existsSync(candidate), `Missing dependency ${name}`);
      if (name === 'use-sync-external-store') {
        cpSync(candidate, join(modules, name), {
          recursive: true,
          dereference: true,
        });
      } else {
        link(name, candidate);
      }
      linked.add(name);
    }
  }
  const consumerRequire = createRequire(join(consumer, 'consumer.cjs'));
  const wasm = readFileSync(
    consumerRequire.resolve(
      '@infinite-canvas-tutorial/device-api/shader-compiler.wasm',
    ),
  );
  const compiler = consumerRequire(
    join(
      modules,
      '@infinite-canvas-tutorial/device-api/lib/vendor/glsl_wgsl_compiler.js',
    ),
  );
  compiler.initSync(wasm);
  const composer = new compiler.WGSLComposer();
  composer.free();
  assert.equal(typeof compiler.glsl_compile, 'function');
  const ssr = `
const assert = require('node:assert/strict');
const React = require('react');
const { renderToString } = require('react-dom/server');
for (const entry of ['@infinite-canvas-tutorial/react', '@infinite-canvas-tutorial/react/spectrum']) {
  const { CanvasProvider, InfiniteCanvas, useCanvasAPI, useCanvasActions, useCanvasSelector, useCanvasNode, useCanvasSelection, useCanvasHistory } = require(entry);
  function Toolbar() {
    const api = useCanvasAPI();
    const actions = useCanvasActions();
    assert.equal(actions.undo(), false);
    assert.equal(useCanvasNode('rect'), null);
    assert.deepEqual(useCanvasSelection(), []);
    assert.deepEqual(useCanvasHistory(), { canUndo: false, canRedo: false });
    assert.equal(typeof actions.deleteNodes, 'function');
    assert.equal(typeof actions.replaceDocument, 'function');
    const zoom = useCanvasSelector(state => state.appState?.cameraZoom ?? 1);
    return React.createElement('output', null, String(api === null) + ':' + zoom);
  }
  const html = renderToString(React.createElement(CanvasProvider, null,
    React.createElement(InfiniteCanvas, { fallback: 'Loading' }), React.createElement(Toolbar)));
  assert(html.includes('Loading') && html.includes('true:1'));
}
assert.equal(typeof window, 'undefined');
`;
  writeFileSync(join(consumer, 'ssr.cjs'), ssr);
  execFileSync(process.execPath, [join(consumer, 'ssr.cjs')], {
    stdio: 'inherit',
  });

  const types = `
import { CanvasProvider, InfiniteCanvas, useCanvasAPI, useCanvasActions, useCanvasSelector, useCanvasNode, useCanvasSelection, useCanvasHistory, type CanvasHistoryState, type CanvasState, type CanvasActions, type CanvasEditOptions } from '@infinite-canvas-tutorial/react';
import type { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { InfiniteCanvas as SpectrumCanvas } from '@infinite-canvas-tutorial/react/spectrum';
function Toolbar() {
  const api = useCanvasAPI();
  const actions: CanvasActions = useCanvasActions();
  const options: CanvasEditOptions = { capture: 'NEVER', signal: new AbortController().signal };
  const update: Promise<boolean> = actions.updateNodes(nodes => nodes.map(node => ({ ...node, width: 100 })), options);
  const patch: Promise<boolean> = actions.setAppState(state => ({ filter: state.filter }), options);
  const selection: Promise<boolean> = actions.selectNodes(['rect'], { preserveSelection: true });
  const deleted: Promise<boolean> = actions.deleteNodes(['rect'], options);
  const replaced: Promise<boolean> = actions.replaceDocument(nodes => nodes.filter(node => !node.isDeleted), options);
  const selected: readonly Readonly<SerializedNode>[] = useCanvasSelection();
  const node: Readonly<SerializedNode> | null = useCanvasNode(selected[0]?.id);
  const history: Readonly<CanvasHistoryState> = useCanvasHistory();
  const edit: Promise<boolean> = actions.edit(api => { api.setAppState({ filter: '' }); });
  const coreEdit: Promise<boolean> | undefined = api?.edit(editor => {
    editor.setAppState({ filter: '' });
    editor.getLocale();
  }, options);
  const imported: Promise<boolean> | undefined = api?.importIcDocument('{}', { recordHistory: false, signal: options.signal });
  const canUndo: boolean = useCanvasSelector((state: CanvasState) => state.canUndo);
  return <button disabled={!canUndo} onClick={() => api?.undo()}>Undo</button>;
}
export const editor = <><CanvasProvider><InfiniteCanvas style={{ height: 400 }} /><Toolbar /></CanvasProvider><SpectrumCanvas /></>;
`;
  writeFileSync(join(consumer, 'consumer.tsx'), types);
  for (const [module, moduleResolution] of [
    ['commonjs', 'node'],
    ['ESNext', 'Bundler'],
  ]) {
    execFileSync(
      process.execPath,
      [
        require.resolve('typescript/bin/tsc'),
        '--noEmit',
        '--strict',
        '--skipLibCheck',
        '--jsx',
        'react-jsx',
        '--target',
        'ES2020',
        '--module',
        module,
        '--moduleResolution',
        moduleResolution,
        join(consumer, 'consumer.tsx'),
      ],
      { stdio: 'inherit' },
    );
  }

  // Bundlers must resolve the import condition to ESM, and SSR must not evaluate
  // dynamically loaded browser dependencies. Exercise both public entries.
  const { build } = createRequire(require.resolve('vite/package.json'))(
    'esbuild',
  );
  for (const entry of [
    '@infinite-canvas-tutorial/react',
    '@infinite-canvas-tutorial/react/spectrum',
  ]) {
    const outfile = join(consumer, 'esm-ssr.cjs');
    const result = await build({
      stdin: {
        contents:
          `import * as bindings from '${entry}';\n` +
          ssr
            .replace('require(entry)', 'bindings')
            .replace(
              "for (const entry of ['@infinite-canvas-tutorial/react', '@infinite-canvas-tutorial/react/spectrum'])",
              'for (const entry of [0])',
            ),
        resolveDir: consumer,
      },
      bundle: true,
      platform: 'node',
      format: 'cjs',
      conditions: ['import'],
      mainFields: ['module', 'main'],
      external: [
        'react',
        'react-dom',
        '@infinite-canvas-tutorial/ecs',
        '@infinite-canvas-tutorial/webcomponents',
        '@infinite-canvas-tutorial/webcomponents/spectrum',
      ],
      outfile,
      metafile: true,
      logLevel: 'silent',
    });
    assert(
      Object.keys(result.metafile.inputs).some((path) =>
        path.includes('/react/esm/'),
      ),
      'ESM export was not consumed',
    );
    execFileSync(process.execPath, [outfile], { stdio: 'inherit' });
  }

  // Build the copyable framework starters against the packed libraries, rather
  // than workspace aliases or unpublished registry versions.
  link('typescript', join(root, 'node_modules/typescript'));
  link('vite', join(root, 'node_modules/vite'));
  mkdirSync(join(modules, '.bin'));
  symlinkSync(join(modules, 'typescript/bin/tsc'), join(modules, '.bin/tsc'));
  symlinkSync(join(modules, 'vite/bin/vite.js'), join(modules, '.bin/vite'));
  const examples = join(consumer, 'examples');
  cpSync(join(root, 'examples/react-vite'), join(examples, 'react-vite'), {
    recursive: true,
  });
  const viteExample = join(examples, 'react-vite');
  execFileSync(
    process.execPath,
    [require.resolve('typescript/bin/tsc'), '-p', viteExample],
    {
      stdio: 'inherit',
    },
  );
  execFileSync(
    process.execPath,
    [join(root, 'node_modules/vite/bin/vite.js'), 'build'],
    {
      cwd: viteExample,
      stdio: 'inherit',
    },
  );
  assert(existsSync(join(viteExample, 'dist/index.html')));

  // Next.js 16 requires React 19. React 18 still exercises the standalone Vite
  // consumer, package exports, SSR rendering, and types above.
  const reactVersion = JSON.parse(
    readFileSync(join(modules, 'react/package.json'), 'utf8'),
  ).version;
  if (reactVersion.startsWith('19.')) {
    link('next', join(root, 'packages/app/node_modules/next'));
    symlinkSync(
      join(modules, 'next/dist/bin/next'),
      join(modules, '.bin/next'),
    );
    link('@types/node', join(root, 'packages/app/node_modules/@types/node'));
    const nextExample = join(examples, 'react-nextjs');
    cpSync(join(root, 'examples/react-nextjs'), nextExample, {
      recursive: true,
    });
    execFileSync(
      process.execPath,
      [join(modules, 'next/dist/bin/next'), 'build', '--webpack'],
      {
        cwd: nextExample,
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: '1',
          CIRCLE_NODE_TOTAL: '2',
        },
        stdio: 'inherit',
      },
    );
    const html = readFileSync(
      join(nextExample, '.next/server/app/index.html'),
      'utf8',
    );
    assert(
      html.includes('React canvas with Next.js') &&
        html.includes('Loading canvas'),
    );
  }
  console.log(
    `Packed React ${reactVersion}: CommonJS/ESM SSR, types, Vite${
      reactVersion.startsWith('19.') ? ', and Next.js SSR' : ''
    } passed.`,
  );
} finally {
  if (process.env.REACT_PACKAGE_KEEP_ARTIFACTS === '1') {
    console.log(`Consumer artifacts: ${consumer}`);
  } else {
    rmSync(consumer, { recursive: true, force: true });
  }
}
