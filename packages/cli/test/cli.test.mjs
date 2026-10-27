import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIcDocumentJson } from '@infinite-canvas-tutorial/ecs/document';
import { serializedNodesToCode } from '@infinite-canvas-tutorial/ecs/codegen';

const bin = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const fixture = {
  type: 'infinite-canvas',
  version: 1,
  variables: { 'color.primary': { type: 'color', value: '#ff0000' } },
  themes: { mode: 'light' },
  appState: {},
  elements: [
    {
      id: 'card',
      type: 'rect',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      zIndex: 0,
      fills: [{ type: 'solid', value: '$color.primary' }],
    },
  ],
};

function withDocument(t, document = fixture) {
  const dir = mkdtempSync(join(tmpdir(), 'ic-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'design.ic');
  writeFileSync(file, JSON.stringify(document));
  return { dir, file };
}

function run(...args) {
  return execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
}

test('Node document and codegen entries match the CLI outputs', (t) => {
  const { dir, file } = withDocument(t);
  const doc = parseIcDocumentJson(readFileSync(file, 'utf8'));
  assert.match(run('validate', file), /Valid .ic document: 1 nodes/);
  assert.deepEqual(JSON.parse(run('inspect', file, '--json')), {
    nodes: 1,
    roots: ['card'],
    reusable: [],
    variables: ['color.primary'],
    assets: { dataUrls: 0, blobUrls: 0, remoteUrls: 0 },
  });
  const args = [
    'codegen',
    file,
    '--framework',
    'react-tailwind',
    '--variables-mode',
    'css-var',
    '--component-name',
    'Card',
  ];
  const expected = serializedNodesToCode(doc.elements, {
    framework: 'react-tailwind',
    variablesMode: 'css-var',
    componentName: 'Card',
    variables: doc.variables,
    themeMode: doc.themes.mode,
  });
  assert.equal(run(...args), expected);
  assert.equal(run(...args), expected);
  const output = join(dir, 'Card.tsx');
  assert.equal(run(...args, '-o', output), '');
  assert.equal(readFileSync(output, 'utf8'), expected);
  assert.match(
    run('codegen', file, '--framework', 'html-css'),
    /background-color/,
  );
});

test('invalid documents and temporary browser assets fail clearly', (t) => {
  const invalid = withDocument(t, {
    ...fixture,
    elements: [{ ...fixture.elements[0], parentId: 'missing' }],
  });
  const failedValidation = spawnSync(
    process.execPath,
    [bin, 'validate', invalid.file],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(failedValidation.status, 1);
  assert.match(failedValidation.stderr, /Missing parent missing/);
  const blob = withDocument(t, {
    ...fixture,
    elements: [
      {
        ...fixture.elements[0],
        fills: [{ type: 'image', value: 'blob:https://canvas.test/image-id' }],
      },
    ],
  });
  const failedCodegen = spawnSync(
    process.execPath,
    [bin, 'codegen', blob.file],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(failedCodegen.status, 1);
  assert.match(failedCodegen.stderr, /Temporary blob: assets/);
  assert.match(run('inspect', blob.file, '--json'), /"blobUrls": 1/);
});
