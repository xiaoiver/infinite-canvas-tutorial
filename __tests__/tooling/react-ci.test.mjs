import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { discover } from './helpers/playwright-discovery.mjs';

const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint'))('js-yaml');
const workflow = load(readFileSync('.github/workflows/react.yml', 'utf8'));
const matrix = workflow.jobs['browser-tests'].strategy.matrix;

for (const browser of ['chromium', 'webkit']) {
  test(`React ${browser} shards run every discovered test exactly once`, () => {
    const groups = matrix.group.filter((group) => group.browser === browser);
    const all = discover(groups[0].config);
    const sizes = [];
    const partitioned = groups.flatMap(({ config, shard }) => {
      const ids = discover(config, shard);
      assert(ids.length > 0, `empty ${browser} shard ${shard}`);
      sizes.push(ids.length);
      return ids;
    });
    assert(all.length > 50);
    assert.equal(new Set(partitioned).size, partitioned.length, 'duplicates');
    assert.deepEqual(partitioned.sort(), all.sort(), 'missing tests');
    assert(Math.max(...sizes) - Math.min(...sizes) <= 1, 'unbalanced shards');
  });
}

test('React compatibility gates retain their names and require all matrix results', () => {
  const gate = workflow.jobs.react;
  assert.deepEqual(matrix.react, ['18.2.0', '19.2.3']);
  assert.deepEqual(workflow.jobs.checks.strategy.matrix.react, matrix.react);
  assert.deepEqual(gate.strategy.matrix.react, matrix.react);
  // GitHub's default matrix name remains react (18.2.0) / react (19.2.3).
  assert.equal(gate.name, undefined);
  assert.equal(gate.if, '${{ always() }}');
  assert.deepEqual(gate.needs.sort(), ['browser-tests', 'checks']);
  const step = gate.steps[0];
  assert.equal(step.env.CHECKS_RESULT, '${{ needs.checks.result }}');
  assert.equal(
    step.env.BROWSER_TESTS_RESULT,
    '${{ needs.browser-tests.result }}',
  );
  for (const checks of ['success', 'failure', 'cancelled', 'skipped', '']) {
    for (const browsers of ['success', 'failure', 'cancelled', 'skipped', '']) {
      const result = spawnSync('bash', ['-e', '-c', step.run], {
        env: {
          ...process.env,
          CHECKS_RESULT: checks,
          BROWSER_TESTS_RESULT: browsers,
        },
      });
      assert.equal(
        result.status === 0,
        checks === 'success' && browsers === 'success',
      );
    }
  }
});
