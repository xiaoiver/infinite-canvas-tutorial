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
  // A fresh process exercises the default lazy ESM asset resolver from the
  // CommonJS package, rather than reusing the initSync instance above.
  const defaultCompiler = `
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
let requests = 0;
globalThis.fetch = async url => {
  assert(url instanceof URL);
  assert(url.pathname.endsWith('/lib/vendor/glsl_wgsl_compiler_bg.wasm'));
  requests++;
  return new Response(readFileSync(url), { headers: { 'Content-Type': 'application/wasm' } });
};
const compiler = require('./node_modules/@infinite-canvas-tutorial/device-api/lib/vendor/glsl_wgsl_compiler.js');
assert.equal(requests, 0);
(async () => {
  await compiler.default();
  await compiler.default();
  assert.equal(requests, 1);
  const wgsl = compiler.glsl_compile('#version 440\\nvoid main() { gl_Position = vec4(0.0, 0.0, 0.0, 1.0); }', 'vertex', true);
  assert(wgsl.includes('@vertex') && wgsl.includes('@builtin(position)'));
})().catch(error => { console.error(error); process.exitCode = 1; });
`;
  writeFileSync(join(consumer, 'default-compiler.cjs'), defaultCompiler);
  execFileSync(process.execPath, [join(consumer, 'default-compiler.cjs')], {
    stdio: 'inherit',
  });
  const ssr = `
const assert = require('node:assert/strict');
const React = require('react');
const { renderToString } = require('react-dom/server');
for (const entry of ['@infinite-canvas-tutorial/react', '@infinite-canvas-tutorial/react/spectrum']) {
  const { createCanvasRuntime, CanvasProvider, InfiniteCanvas, useCanvasAPI, useCanvasActions, useCanvasSelector, useCanvasNode, useCanvasSelection, useCanvasHistory, useCanvasStatus, useCanvasCamera, useCanvasCoordinates, useCanvasEvent, useCanvasShortcuts } = require(entry);
  function Toolbar() {
    const api = useCanvasAPI();
    const actions = useCanvasActions();
    const shortcuts = useCanvasShortcuts();
    assert.equal(shortcuts.tabIndex, 0);
    assert.equal(typeof shortcuts.onKeyDownCapture, 'function');
    assert.equal(actions.undo(), false);
    assert.deepEqual(useCanvasStatus(), { status: 'idle', error: null });
    assert.deepEqual(useCanvasCamera(), { x: 0, y: 0, zoom: 1, rotation: 0 });
    for (const convert of Object.values(useCanvasCoordinates())) {
      assert.equal(convert({ x: 10, y: 20 }), null);
    }
    assert.equal(actions.zoomTo(2), false);
    assert.equal(actions.fitToScreen(), false);
    assert.equal(useCanvasNode('rect'), null);
    assert.deepEqual(useCanvasSelection(), []);
    assert.deepEqual(useCanvasHistory(), { canUndo: false, canRedo: false });
    useCanvasEvent('ic-point-drawn', () => { throw new Error('SSR event listener ran'); });
    assert.equal(typeof actions.deleteNodes, 'function');
    assert.equal(typeof actions.replaceDocument, 'function');
    const zoom = useCanvasSelector(state => state.appState?.cameraZoom ?? 1);
    return React.createElement('output', shortcuts, String(api === null) + ':' + zoom);
  }
  const runtime = createCanvasRuntime({
    appOptions: { maxEntities: 16384, maxLimboComponents: 32768 },
    plugins: [() => { throw new Error('SSR plugin ran'); }],
    loadUI: () => { throw new Error('SSR UI loader ran'); },
  });
  const html = renderToString(React.createElement(CanvasProvider, null,
    React.createElement(InfiniteCanvas, { runtime, fallback: 'Loading' }), React.createElement(Toolbar)));
  assert(html.includes('Loading') && html.includes('true:1'));
}
assert.equal(typeof window, 'undefined');
assert(!Object.keys(require.cache).some(path => path.includes('/@infinite-canvas-tutorial/ecs/')), 'SSR loaded the ECS runtime');
`;
  writeFileSync(join(consumer, 'ssr.cjs'), ssr);
  execFileSync(process.execPath, [join(consumer, 'ssr.cjs')], {
    stdio: 'inherit',
  });

  const types = `
import { createCanvasRuntime, type CanvasRuntimeOptions, CanvasProvider, InfiniteCanvas, useCanvasAPI, useCanvasActions, useCanvasSelector, useCanvasNode, useCanvasSelection, useCanvasHistory, useCanvasStatus, useCanvasCamera, useCanvasCoordinates, useCanvasEvent, useCanvasShortcuts, type CanvasCoordinates, type CanvasPoint, type CanvasShortcutOptions, type CanvasShortcutProps, type CanvasCameraState, type CanvasCameraAnimationOptions, type CanvasEventOptions, type CanvasHistoryState, type CanvasStatus, type CanvasState, type CanvasActions, type CanvasEditOptions } from '@infinite-canvas-tutorial/react';
import type { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { InfiniteCanvas as SpectrumCanvas, useCanvasEvent as useSpectrumCanvasEvent, useCanvasCoordinates as useSpectrumCoordinates, type CanvasPoint as SpectrumPoint } from '@infinite-canvas-tutorial/react/spectrum';
const runtimeOptions: CanvasRuntimeOptions = {
  appOptions: { maxEntities: 16384, maxLimboComponents: 32768 },
};
const runtime = createCanvasRuntime(runtimeOptions);
// @ts-expect-error capacities must be numeric
createCanvasRuntime({ appOptions: { maxEntities: '16384' } });
// @ts-expect-error limbo capacity must be numeric
createCanvasRuntime({ appOptions: { maxLimboComponents: '32768' } });
function Toolbar() {
  const shortcutOptions: CanvasShortcutOptions = { enabled: true, onError: (error: Error) => {} };
  const shortcuts: CanvasShortcutProps = useCanvasShortcuts(shortcutOptions);
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
  const lifecycle = useCanvasStatus();
  const status: CanvasStatus = lifecycle.status;
  const startupError: Error | null = lifecycle.error;
  const coordinates: CanvasCoordinates = useCanvasCoordinates();
  const point: CanvasPoint = { x: 10, y: 20 };
  const world: CanvasPoint | null = coordinates.clientToCanvas(point);
  const client: CanvasPoint | null = coordinates.canvasToClient(point);
  const viewport: CanvasPoint | null = coordinates.canvasToViewport(point);
  const fromViewport: CanvasPoint | null = coordinates.viewportToCanvas(point);
  const spectrumPoint: SpectrumPoint | null = useSpectrumCoordinates().clientToCanvas(point);
  // @ts-expect-error points have numeric coordinates
  coordinates.clientToCanvas({ x: '10', y: 20 });
  const camera: CanvasCameraState = useCanvasCamera();
  const cameraOptions: CanvasCameraAnimationOptions = { duration: 0, easing: 'linear', onfinish: () => {} };
  const zoomed: boolean = actions.zoomTo(camera.zoom * 2, cameraOptions);
  const fitted: boolean = actions.fitToScreen(cameraOptions);
  useCanvasEvent('ic-camera-changed', event => { const rotation: number = event.detail.rotation; });
  const eventOptions: CanvasEventOptions = { enabled: status === 'ready', once: true, capture: false, passive: true, signal: options.signal };
  useCanvasEvent('ic-point-drawn', event => {
    const x: number = event.detail.x;
    // @ts-expect-error point events have no zoom property
    event.detail.zoom;
  }, eventOptions);
  useSpectrumCanvasEvent('ic-screenshot-downloaded', event => {
    const svg: string = event.detail.svg;
  });
  useCanvasEvent('pointerdown', event => { const pointerType: string = event.pointerType; });
  // @ts-expect-error unknown events must be declared in HTMLElementEventMap
  useCanvasEvent('ic-unknown-event', () => {});
  const edit: Promise<boolean> = actions.edit(api => { api.setAppState({ filter: '' }); });
  const coreEdit: Promise<boolean> | undefined = api?.edit(editor => {
    editor.setAppState({ filter: '' });
    editor.getLocale();
  }, options);
  const imported: Promise<boolean> | undefined = api?.importIcDocument('{}', { recordHistory: false, signal: options.signal });
  const canUndo: boolean = useCanvasSelector((state: CanvasState) => state.canUndo);
  return <section {...shortcuts}><button disabled={!canUndo} onClick={() => api?.undo()}>Undo</button></section>;
}
export const editor = <><CanvasProvider><InfiniteCanvas runtime={runtime} style={{ height: 400 }} /><Toolbar /></CanvasProvider><SpectrumCanvas runtime={runtime} /></>;
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
  const includesCompiler = (directory) =>
    readdirSync(directory).some(
      (name) =>
        name.endsWith('.wasm') &&
        readFileSync(join(directory, name)).equals(wasm),
    );
  assert(
    includesCompiler(join(viteExample, 'dist/assets')),
    'Vite did not emit the matching bundled shader compiler',
  );

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
    assert(
      includesCompiler(join(nextExample, '.next/static/media')),
      'Next.js did not emit the matching bundled shader compiler',
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
