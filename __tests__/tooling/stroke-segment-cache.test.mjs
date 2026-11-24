import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const collect = String.raw`
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const exportsObject = {};
new Function('exports', readFileSync(0, 'utf8'))(exportsObject);
const cache = new exportsObject.StrokeSegmentCache();
function populate(keepOwner, keepPoints) {
  const owner = {}, points = {}, data = { owner, points };
  const builder = () => data;
  cache.get(owner, points, 'round', 'miter', builder);
  return {
    owner: new WeakRef(owner), points: new WeakRef(points),
    data: new WeakRef(data), builder: new WeakRef(builder),
    kept: { owner: keepOwner ? owner : undefined, points: keepPoints ? points : undefined },
  };
}
(async () => {
  const pointDropped = populate(true, false);
  const ownerDropped = populate(false, true);
  const live = populate(true, true);
  const restyled = populate(true, true);
  const anonymous = populate(true, true);
  cache.get(restyled.kept.owner, restyled.kept.points, 'butt', 'bevel', () => ({}));
  cache.get(anonymous.kept.owner, undefined, 'round', 'miter', () => ({}));
  const failed = populate(true, true);
  assert.throws(() => cache.get(failed.kept.owner, {}, 'butt', 'bevel', () => { throw new Error('build'); }), /build/);
  // Keep the cache and selected keys rooted, independently of V8 stack liveness.
  globalThis.keep = [cache, pointDropped, ownerDropped, live, restyled, anonymous, failed];
  // WeakRef targets stay alive until the end of their creation/deref job.
  for (let i = 0; i < 12; i++) {
    await new Promise(setImmediate);
    global.gc();
  }
  assert.equal(pointDropped.points.deref(), undefined, 'a live owner must not retain dropped samples');
  assert.equal(pointDropped.data.deref(), undefined, 'dropped samples release data, including value/key cycles');
  assert.equal(ownerDropped.owner.deref(), undefined, 'live samples must not retain a dropped owner');
  assert.equal(ownerDropped.data.deref(), undefined, 'dropped owners release derived data');
  assert.ok(live.data.deref(), 'live owner and sample keys preserve a cache hit');
  assert.equal(live.builder.deref(), undefined, 'builders must not be retained');
  assert.equal(restyled.data.deref(), undefined, 'style changes release previous derived data');
  assert.equal(anonymous.data.deref(), undefined, 'unkeyed requests release all previous levels');
  assert.ok(failed.data.deref(), 'a failed style build must preserve previous hits');
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

for (const backend of ['core', 'ecs']) {
  test(`${backend} segment cache releases weak keys, data cycles and builders`, () => {
    const source = new URL(
      `../../packages/${backend}/src/utils/stroke-batching.ts`,
      import.meta.url,
    );
    const { outputText } = ts.transpileModule(readFileSync(source, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    });
    const result = spawnSync(process.execPath, ['--expose-gc', '-e', collect], {
      input: outputText,
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}
