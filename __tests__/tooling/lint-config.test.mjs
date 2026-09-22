import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESLint } from 'eslint';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import prettier from 'prettier';

const eslint = new ESLint();
test('Markdown checks accept Prettier list numbering and indentation', async () => {
  const filePath = '__tests__/browser/README.md';
  const options = await prettier.resolveConfig(filePath, {
    editorconfig: true,
  });
  const formatted = await prettier.format(
    '# Example\n\n3. continued item\n4. next item\n\n- parent\n  - nested\n',
    { ...options, filepath: filePath },
  );
  execFileSync(
    process.execPath,
    ['node_modules/markdownlint-cli/markdownlint.js', '--stdin'],
    { input: formatted, stdio: ['pipe', 'pipe', 'pipe'] },
  );
});
for (const extension of ['ts', 'tsx', 'vue']) {
  test(`ESLint checks ${extension} source instead of silently ignoring it`, async () => {
    const code =
      'var repeated: number = 1; var repeated: number = 2; console.log(repeated);';
    const source =
      extension === 'vue'
        ? `<script lang="ts">${code}</script><template><p>test</p></template>`
        : code;
    const [result] = await eslint.lintText(source, {
      filePath: `__tests__/tooling/check.${extension}`,
    });
    assert(
      result.messages.some(
        (message) => message.ruleId === '@typescript-eslint/no-redeclare',
      ),
      JSON.stringify(result.messages),
    );
  });
}
test('Vue template references and Node/Jest globals are understood', async () => {
  for (const [filePath, source] of [
    [
      'packages/site/docs/components/Check.vue',
      '<script setup lang="ts">const message: string = "hello";</script><template><p>{{ message }}</p></template>',
    ],
    [
      '__tests__/ecs/check.spec.ts',
      'test("works", () => expect(process.version).toBeDefined());',
    ],
    ['scripts/check.cjs', 'module.exports = process.version;'],
  ]) {
    const [result] = await eslint.lintText(source, { filePath });
    assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
  }
});
test('generated output and vendored code are excluded, maintained source is included', async () => {
  for (const file of [
    'packages/ecs/esm/API.js',
    'packages/ecs/lib/API.js',
    'packages/plugin-lottie/vendor/third-party.js',
    'playwright/.cache/generated.js',
  ])
    assert.equal(await eslint.isPathIgnored(file), true, file);
  for (const file of [
    'packages/ecs/src/API.ts',
    'packages/site/docs/lib/ensure-example-world.ts',
    '__tests__/browser/lifecycle.spec.ts',
  ])
    assert.equal(await eslint.isPathIgnored(file), false, file);
});

test('merge hook checks resolutions and staged edits, excluding unchanged incoming files', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'canvas-hook-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, stdio: 'pipe' }).toString();
  git('init', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  writeFileSync(path.join(root, 'base.json'), '{}\n');
  git('add', '.');
  git('commit', '-m', 'base');
  git('switch', '-c', 'incoming');
  writeFileSync(path.join(root, 'upstream.json'), '{}\n');
  writeFileSync(path.join(root, 'base.json'), '{"incoming":true}\n');
  git('add', '.');
  git('commit', '-m', 'upstream');
  git('switch', 'main');
  writeFileSync(path.join(root, 'our file.json'), '{}\n');
  writeFileSync(path.join(root, 'base.json'), '{"ours":true}\n');
  git('add', '.');
  git('commit', '-m', 'ours');
  assert.throws(() => git('merge', '--no-commit', '--no-ff', 'incoming'));
  assert(git('diff', '--name-only', '--diff-filter=U').includes('base.json'));
  writeFileSync(path.join(root, 'base.json'), '{"resolved":true}\n');
  writeFileSync(path.join(root, 'our file.json'), '{"edited":true}\n');
  git('add', '.');
  const configPath = path.resolve('scripts/lint-staged.config.cjs');
  const filenames = git('diff', '--cached', '--name-only', '-z')
    .split('\0')
    .filter(Boolean)
    .map((file) => path.join(root, file));
  const commands = JSON.parse(
    execFileSync(
      process.execPath,
      [
        '-e',
        `console.log(JSON.stringify(require(${JSON.stringify(
          configPath,
        )})['*.json'](${JSON.stringify(filenames)})))`,
      ],
      { cwd: root, encoding: 'utf8' },
    ),
  );
  assert.equal(commands.length, 1);
  assert(commands[0].includes('base.json'));
  assert(commands[0].includes('our file.json'));
  assert(!commands[0].includes('upstream.json'));
  git('merge', '--abort');
  const normal = JSON.parse(
    execFileSync(
      process.execPath,
      [
        '-e',
        `console.log(JSON.stringify(require(${JSON.stringify(
          configPath,
        )})['*.json'](${JSON.stringify(filenames)})))`,
      ],
      { cwd: root, encoding: 'utf8' },
    ),
  );
  assert(normal[0].includes('upstream.json'));
});
