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
  const ssr = `
const assert = require('node:assert/strict');
const React = require('react');
const { renderToString } = require('react-dom/server');
for (const entry of ['@infinite-canvas-tutorial/react', '@infinite-canvas-tutorial/react/spectrum']) {
  const { CanvasProvider, InfiniteCanvas, useCanvasAPI, useCanvasSelector } = require(entry);
  function Toolbar() {
    const api = useCanvasAPI();
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
import { CanvasProvider, InfiniteCanvas, useCanvasAPI, useCanvasSelector, type CanvasState } from '@infinite-canvas-tutorial/react';
import { InfiniteCanvas as SpectrumCanvas } from '@infinite-canvas-tutorial/react/spectrum';
function Toolbar() {
  const api = useCanvasAPI();
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
  console.log(
    'Packed React package: CommonJS/ESM SSR and both TypeScript resolutions passed.',
  );
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
