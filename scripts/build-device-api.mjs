import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const format = process.argv[2];
if (!['commonjs', 'ESNext'].includes(format)) {
  throw new Error('Expected commonjs or ESNext.');
}
const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'rust/glsl-wgsl-compiler/pkg');
const packageRoot = join(root, 'packages/device-api');
const name = 'glsl_wgsl_compiler';

const output = join(packageRoot, format === 'commonjs' ? 'lib' : 'esm');
rmSync(output, { recursive: true, force: true });
execFileSync(
  process.execPath,
  [
    join(root, 'node_modules/typescript/bin/tsc'),
    '-p',
    join(packageRoot, 'tsconfig.build.json'),
    '--module',
    format,
    '--outDir',
    output,
  ],
  { cwd: packageRoot, stdio: 'inherit' },
);

const vendor = join(output, 'vendor');
mkdirSync(vendor, { recursive: true });
// Replace the source bridge with bindings and assets inside the npm package.
const javascript = readFileSync(join(source, `${name}.js`), 'utf8');
writeFileSync(
  join(vendor, `${name}.js`),
  format === 'commonjs'
    ? ts.transpileModule(javascript, {
        fileName: `${name}.js`,
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
        },
      }).outputText
    : javascript,
);
for (const suffix of ['.d.ts', '_bg.wasm', '_bg.wasm.d.ts']) {
  copyFileSync(
    join(source, `${name}${suffix}`),
    join(vendor, `${name}${suffix}`),
  );
}
