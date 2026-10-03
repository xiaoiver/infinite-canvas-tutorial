import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const resolveFrom = (parent, name) =>
  createRequire(parent).resolve(`${name}/package.json`);
const changesets = require.resolve('@changesets/cli/package.json');
const config = resolveFrom(changesets, '@changesets/config');
const micromatch = resolveFrom(config, 'micromatch');
const braces = createRequire(micromatch)('braces');
const gl = require.resolve('gl/package.json');
const nodeGyp = resolveFrom(gl, 'node-gyp');
const fetch = resolveFrom(nodeGyp, 'make-fetch-happen');
const CachePolicy = createRequire(fetch)('http-cache-semantics');

test('audit exceptions are backed by registered patches for installed tooling', () => {
  const { pnpm } = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url)),
  );
  assert.deepEqual(pnpm.auditConfig.ignoreCves.toSorted(), [
    'CVE-2026-93687',
    'CVE-2026-93748',
  ]);
  for (const [name, version, cve] of [
    ['braces', '3.0.3', 'CVE-2026-93687'],
    ['http-cache-semantics', '4.1.1', 'CVE-2026-93748'],
  ]) {
    const patch = pnpm.patchedDependencies[`${name}@${version}`];
    assert.equal(patch, `patches/${name}@${version}.patch`);
    assert(readFileSync(new URL(`../../${patch}`, import.meta.url)).length > 0);
    assert(pnpm.auditConfig.ignoreCves.includes(cve));
    const installed = resolveFrom(name === 'braces' ? micromatch : fetch, name);
    assert.equal(
      JSON.parse(readFileSync(installed)).version,
      version,
      'Review the local patch and audit exception when upgrading this dependency',
    );
  }
});

test('braces handles normal ranges, nesting, and escaped literals', () => {
  assert.deepEqual(braces.expand('src/{app,lib}/{1..3}.ts'), [
    'src/app/1.ts',
    'src/app/2.ts',
    'src/app/3.ts',
    'src/lib/1.ts',
    'src/lib/2.ts',
    'src/lib/3.ts',
  ]);
  assert.equal(braces.compile('a/{b,{c,d}}/e'), 'a/(b|(c|d))/e');
  assert.equal(
    braces.stringify(braces.parse('{'.repeat(40) + 'x' + '}'.repeat(40))),
    '{'.repeat(40) + 'x' + '}'.repeat(40),
  );
  assert.doesNotThrow(() => braces.compile('\\{'.repeat(1000)));
});

test('braces rejects deeply nested patterns before recursive walkers overflow', () => {
  for (const pattern of [
    '{'.repeat(4000) + 'a,b' + '}'.repeat(4000),
    '{'.repeat(4000) + 'x',
    '('.repeat(4000) + 'x' + ')'.repeat(4000),
    '{('.repeat(1000) + 'x' + ')}'.repeat(1000),
  ]) {
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      assert.throws(() => braces[method](pattern), {
        name: 'SyntaxError',
        message: /maximum depth/,
      });
    }
  }
  let ast = { type: 'text', value: 'x' };
  for (let i = 0; i < 10000; i++) ast = { type: 'root', nodes: [ast] };
  for (const method of ['compile', 'expand', 'stringify']) {
    assert.throws(() => braces[method](ast), {
      name: 'SyntaxError',
      message: /maximum depth/,
    });
  }
});

const request = (headers = {}) => ({
  url: 'https://example.test/account',
  method: 'GET',
  headers,
});
const response = (headers) => ({ status: 200, headers });

test('max-stale cannot revive shared cache entries rejected for security', () => {
  for (const headers of [
    { 'set-cookie': 'session=secret' },
    { 'cache-control': 'private, max-age=600', 'set-cookie': 'session=secret' },
    { 'cache-control': 'no-store' },
    { 'cache-control': 'no-cache, max-age=600' },
    { 'cache-control': 'proxy-revalidate, max-age=600' },
    { vary: '*' },
  ]) {
    const policy = new CachePolicy(request(), response(headers));
    for (const maxStale of ['max-stale', 'max-stale=999999']) {
      assert.equal(
        policy.satisfiesWithoutRevalidation(
          request({ 'cache-control': maxStale }),
        ),
        false,
        JSON.stringify(headers),
      );
      const restored = CachePolicy.fromObject(policy.toObject());
      assert.equal(
        restored.satisfiesWithoutRevalidation(
          request({ 'cache-control': maxStale }),
        ),
        false,
      );
    }
  }
  const authenticated = new CachePolicy(
    request({ authorization: 'Bearer secret' }),
    response({}),
  );
  assert.equal(
    authenticated.satisfiesWithoutRevalidation(
      request({ 'cache-control': 'max-stale' }),
    ),
    false,
  );
});

test('public freshness and explicit stale handling continue to work', () => {
  const fresh = new CachePolicy(
    request(),
    response({ 'cache-control': 'public, max-age=600' }),
  );
  assert.equal(fresh.satisfiesWithoutRevalidation(request()), true);
  const stale = new CachePolicy(
    request(),
    response({ 'cache-control': 'public, max-age=0' }),
  );
  assert.equal(stale.satisfiesWithoutRevalidation(request()), false);
  assert.equal(
    stale.satisfiesWithoutRevalidation(
      request({ 'cache-control': 'max-stale=600' }),
    ),
    true,
  );
  const privateCache = new CachePolicy(
    request(),
    response({
      'cache-control': 'private, max-age=600',
      'set-cookie': 'session=secret',
    }),
    { shared: false },
  );
  assert.equal(privateCache.satisfiesWithoutRevalidation(request()), true);
});
