import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PNG } from 'pngjs';

test('isolated contexts preserve options, cleanup and failure artifacts', async ({
  browserName,
}) => {
  test.setTimeout(90000);
  const directory = await mkdtemp(path.join(tmpdir(), 'isolated-browser-'));
  try {
    const fixture = path.resolve('__tests__/isolated-webkit-test.ts');
    await writeFile(
      path.join(directory, 'lifecycle.spec.ts'),
      `import { test } from ${JSON.stringify(fixture)};
import { expect } from ${JSON.stringify(require.resolve('@playwright/test'))};
let previousContext;
let closed = false;
test.beforeEach(async ({ page }) => {
  await page.route('http://fixture.test/**', route => route.fulfill({
    contentType: 'text/html', body: '<h1>Lifecycle fixture</h1>',
  }));
  await page.goto('/');
});
test('configured context', async ({ page, context }) => {
  expect(page.viewportSize()).toEqual({ width: 320, height: 240 });
  expect(await page.evaluate(() => ({
    scale: devicePixelRatio,
    locale: navigator.language,
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }))).toEqual({ scale: 2, locale: 'fr-FR', dark: true, timezone: 'Europe/Paris' });
  await page.evaluate(() => {
    window.touchStarts = 0;
    addEventListener('touchstart', () => { window.touchStarts++; });
  });
  await page.touchscreen.tap(10, 10);
  expect(await page.evaluate(() => window.touchStarts)).toBe(1);
  await page.evaluate(() => localStorage.setItem('previous', 'present'));
  previousContext = context;
  context.on('close', () => { closed = true; });
});
test('previous context is closed and storage is isolated', async ({ page, context, browserName }) => {
  expect(closed).toBe(true);
  expect(context).not.toBe(previousContext);
  expect(previousContext.browser().isConnected()).toBe(browserName !== 'webkit');
  expect(await page.evaluate(() => localStorage.getItem('previous'))).toBeNull();
});
test('intentional failure retains artifacts', async ({ page }) => {
  await expect(page.locator('h1')).toHaveText('Lifecycle fixture');
  throw new Error('intentional failure');
});`,
    );
    await writeFile(
      path.join(directory, 'playwright.config.cjs'),
      `module.exports = ${JSON.stringify({
        testDir: directory,
        workers: 1,
        retries: 0,
        timeout: 15000,
        reporter: [
          ['json', { outputFile: path.join(directory, 'results.json') }],
        ],
        outputDir: path.join(directory, 'artifacts'),
        use: {
          browserName,
          baseURL: 'http://fixture.test',
          viewport: { width: 320, height: 240 },
          deviceScaleFactor: 2,
          locale: 'fr-FR',
          timezoneId: 'Europe/Paris',
          hasTouch: true,
          colorScheme: 'dark',
          trace: 'retain-on-failure',
          screenshot: 'only-on-failure',
        },
      })};`,
    );
    const result = await promisify(execFile)(
      process.execPath,
      [
        require.resolve('@playwright/test/cli'),
        'test',
        '-c',
        path.join(directory, 'playwright.config.cjs'),
        '--global-timeout=60000',
      ],
      {
        timeout: 75000,
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: '' },
      },
    ).then(
      () => ({ code: 0, stderr: '' }),
      (error) => ({ code: error.code, stderr: error.stderr }),
    );
    expect(result.code, result.stderr).toBe(1);
    const report = JSON.parse(
      await readFile(path.join(directory, 'results.json'), 'utf8'),
    );
    expect(report.errors).toEqual([]);
    const results = report.suites[0].specs.map(
      (spec) => spec.tests[0].results[0],
    );
    expect(
      results.map((result) => result.status),
      JSON.stringify(results.map((result) => result.errors)),
    ).toEqual(['passed', 'passed', 'failed']);
    expect(results[2].error.message).toContain('intentional failure');
    const attachments = results[2].attachments;
    const trace = attachments.find((attachment) => attachment.name === 'trace');
    expect(trace).toBeDefined();
    expect((await stat(trace.path)).size).toBeGreaterThan(0);
    const screenshot = attachments.find(
      (attachment) => attachment.name === 'screenshot',
    );
    expect(screenshot).toBeDefined();
    const png = PNG.sync.read(await readFile(screenshot.path));
    expect([png.width, png.height]).toEqual([640, 480]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
