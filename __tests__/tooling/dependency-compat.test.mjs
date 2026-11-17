import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const requireFrom = (parent, name) => createRequire(parent.resolve(name));
const rimrafRequire = requireFrom(require, 'rimraf');
const { rimraf, rimrafSync } = require('rimraf');
const { glob } = rimrafRequire('glob');

const fixture = (t) => {
  const cwd = fs.mkdtempSync(path.join(tmpdir(), 'dependency-compat-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
};

test('rimraf retains asynchronous and synchronous glob deletion', async (t) => {
  const cwd = fixture(t);
  for (const name of ['async/a.txt', 'sync/b.txt', 'keep.txt']) {
    const file = path.join(cwd, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'fixture');
  }
  assert.equal(await rimraf('async/*.txt', { glob: { cwd } }), true);
  assert.equal(rimrafSync('sync/*.txt', { glob: { cwd } }), true);
  assert.equal(fs.existsSync(path.join(cwd, 'async/a.txt')), false);
  assert.equal(fs.existsSync(path.join(cwd, 'sync/b.txt')), false);
  assert.equal(fs.readFileSync(path.join(cwd, 'keep.txt'), 'utf8'), 'fixture');
});

test('aborted glob traversal does not keep reading descendant directories', async (t) => {
  const cwd = fixture(t);
  for (let i = 0; i < 8; i++) {
    fs.mkdirSync(path.join(cwd, `child-${i}`, 'nested'), { recursive: true });
  }
  const controller = new AbortController();
  const reason = new Error('stop traversal');
  let reads = 0;
  const instrumentedFs = {
    ...fs,
    readdir(...args) {
      reads++;
      const callback = args.pop();
      fs.readdir(...args, (error, entries) => {
        // Abort after the root read, before the walker receives its children.
        if (!controller.signal.aborted) controller.abort(reason);
        callback(error, entries);
      });
    },
  };
  await assert.rejects(
    glob('**/*', { cwd, fs: instrumentedFs, signal: controller.signal }),
    (error) => error === reason,
  );
  // Allow any incorrectly scheduled background recursion to become observable.
  await delay(50);
  assert.equal(reads, 1, 'the aborted walker must not read child directories');
});

const siteRequire = createRequire(
  new URL('../../packages/site/package.json', import.meta.url),
);
const appRequire = createRequire(
  new URL('../../packages/app/package.json', import.meta.url),
);
const consumers = [
  [
    'typescript-eslint',
    require,
    ['@typescript-eslint/parser', '@typescript-eslint/typescript-estree'],
  ],
  [
    'Vue language tools',
    siteRequire,
    ['unplugin-vue-macros', '@vue-macros/volar', '@vue/language-core'],
  ],
  ['ts-morph', appRequire, ['shadcn', 'ts-morph', '@ts-morph/common']],
];

for (const [name, base, chain] of consumers) {
  test(`${name} retains named minimatch APIs with bounded preprocessing`, () => {
    const consumerRequire = chain.reduce(requireFrom, base);
    const { minimatch, Minimatch } = consumerRequire('minimatch');
    assert.equal(minimatch('src/example.ts', '**/*.ts', { dot: true }), true);
    assert.equal(minimatch('src/example.js', '**/*.ts'), false);
    assert.equal(minimatch('data-id', 'data-*'), true);
    assert.equal(new Minimatch('**/*.{ts,tsx}').match('src/example.tsx'), true);
    const amplified = new Minimatch(`a/${'**/../b/c/'.repeat(8)}z`, {
      optimizationLevel: 2,
      braceExpandMax: 16,
    });
    assert(
      amplified.globParts.length <= 16,
      'globstar preprocessing must honor the expansion budget',
    );
  });
}

test('older ESLint and glob consumers keep callable minimatch APIs', () => {
  const eslintRequire = requireFrom(require, 'eslint');
  const minimatch = eslintRequire('minimatch');
  assert.equal(typeof minimatch, 'function');
  assert.equal(minimatch('src/example.js', '**/*.js'), true);
  // Jest still uses callback-era glob; the upgrade must not replace that API.
  const jestRequire = requireFrom(requireFrom(require, 'jest'), '@jest/core');
  const runtimeRequire = requireFrom(jestRequire, 'jest-runtime');
  const legacyGlob = runtimeRequire('glob');
  assert.equal(typeof legacyGlob, 'function');
  assert.equal(typeof legacyGlob.sync, 'function');
});

test('Vite blocks denied files even with raw/import query parameters', async (t) => {
  const { createServer } = await import('vite');
  const cwd = fixture(t);
  const sentinel = 'DEPENDENCY_TEST_SECRET=must-not-be-served';
  fs.writeFileSync(path.join(cwd, '.env'), sentinel);
  fs.writeFileSync(
    path.join(cwd, 'index.html'),
    '<!doctype html><title>fixture</title>',
  );
  const server = await createServer({
    configFile: false,
    root: cwd,
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: {
      host: '127.0.0.1',
      port: 0,
      fs: { strict: true, allow: [cwd], deny: ['.env'] },
    },
  });
  t.after(() => server.close());
  await server.listen();
  const address = server.httpServer.address();
  for (const query of ['', '?raw', '?import&raw', '?import&url&inline']) {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/.env${query}`,
    );
    assert.equal(
      response.status,
      403,
      `denied file leaked via ${query || 'plain request'}`,
    );
    assert.equal((await response.text()).includes(sentinel), false);
  }
});

test('the SDK Hono CSRF middleware rejects cross-origin text/ping', async () => {
  const shadcnRequire = requireFrom(appRequire, 'shadcn');
  const sdkRequire = createRequire(
    shadcnRequire.resolve('@modelcontextprotocol/sdk/package.json'),
  );
  const { Hono } = sdkRequire('hono');
  const { csrf } = sdkRequire('hono/csrf');
  const app = new Hono();
  app.use('*', csrf());
  app.post('/ping', (c) => c.text('accepted'));
  const send = (origin) =>
    app.request('https://trusted.example/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'text/ping', Origin: origin },
      body: 'PING',
    });
  assert.equal((await send('https://untrusted.example')).status, 403);
  assert.equal((await send('https://trusted.example')).status, 200);
});
