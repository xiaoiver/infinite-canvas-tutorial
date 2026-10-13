import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import type {} from './fixtures/shader-compiler';

const wasm = resolve('rust/glsl-wgsl-compiler/pkg/glsl_wgsl_compiler_bg.wasm');

test('loads the bundled compiler only when needed and compiles real GLSL', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/shader-compiler.html');
  await page.waitForFunction(() => !!window.shaderCompilerRegression);
  expect(requests.filter((url) => url.endsWith('.wasm'))).toEqual([]);

  for (let i = 0; i < 2; i++) {
    const wgsl = await page.evaluate(() =>
      window.shaderCompilerRegression.compile(),
    );
    expect(wgsl).toContain('@vertex');
    expect(wgsl).toContain('@builtin(position)');
  }
  const wasmRequests = requests.filter((url) => url.endsWith('.wasm'));
  expect(wasmRequests).toHaveLength(1);
  expect(wasmRequests[0]).toContain('/glsl_wgsl_compiler_bg.wasm');
  expect(
    requests.every((url) => new URL(url).origin === new URL(page.url()).origin),
  ).toBe(true);
});

test('honors an explicit compiler URL without requesting the default asset', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.wasm')) requests.push(request.url());
  });
  await page.route('**/custom-compiler.wasm', (route) =>
    route.fulfill({ path: wasm, contentType: 'application/wasm' }),
  );
  await page.goto('/shader-compiler.html');
  await page.waitForFunction(() => !!window.shaderCompilerRegression);
  const wgsl = await page.evaluate(() =>
    window.shaderCompilerRegression.compile('/custom-compiler.wasm'),
  );
  expect(wgsl).toContain('@vertex');
  expect(requests).toEqual([new URL('/custom-compiler.wasm', page.url()).href]);
});

test('surfaces compiler errors and can retry with the bundled WASM', async ({
  page,
}) => {
  await page.route('**/broken-compiler.wasm', (route) =>
    route.fulfill({ body: 'invalid wasm', contentType: 'application/wasm' }),
  );
  await page.goto('/shader-compiler.html');
  await page.waitForFunction(() => !!window.shaderCompilerRegression);
  const error = await page.evaluate(async () => {
    try {
      await window.shaderCompilerRegression.initializeDevice(
        '/broken-compiler.wasm',
      );
      return null;
    } catch (error) {
      return (error as Error).name;
    }
  });
  expect(error).toBe('CompileError');
  expect(
    await page.evaluate(() => window.shaderCompilerRegression.compile()),
  ).toContain('@vertex');
});
