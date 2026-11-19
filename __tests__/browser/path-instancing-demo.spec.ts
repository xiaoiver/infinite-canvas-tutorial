import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/path-instancing-demo';
import { PNG } from 'pngjs';

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  await page.addInitScript(installProbes);
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.pathInstancingDemo?.unmount());
  expect(errors).toEqual([]);
});
function compare(a: Buffer, b: Buffer) {
  const x = PNG.sync.read(a),
    y = PNG.sync.read(b);
  expect([x.width, x.height]).toEqual([y.width, y.height]);
  let ink = 0,
    difference = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    if (x.data[i] < 200 || x.data[i + 1] < 200 || x.data[i + 2] < 200) ink++;
    if ([0, 1, 2, 3].some((c) => Math.abs(x.data[i + c] - y.data[i + c]) > 3))
      difference++;
  }
  expect(ink).toBeGreaterThan(100);
  expect(difference).toBeLessThan(30);
}
test('both real renderers show repeated versus alternating submissions and preserve exported pixels', async ({
  page,
}) => {
  await page.goto('/path-instancing-demo.html');
  const toggle = page.getByRole('checkbox', { name: 'Path instancing' });
  await expect(toggle).toBeEnabled({ timeout: 20000 });
  for (const renderer of ['core', 'ecs']) {
    await expect(page.getByTestId(`${renderer}-visible`)).toHaveText('100');
    await expect(page.getByTestId(`${renderer}-drawcalls`)).toHaveText('2');
  }
  const nodes = await page.evaluate(() => window.pathInstancingDemo.nodes());
  const full = await page
    .locator('canvas[aria-label="Core Path canvas"]')
    .screenshot();
  await toggle.uncheck();
  for (const renderer of ['core', 'ecs'])
    await expect(page.getByTestId(`${renderer}-drawcalls`)).toHaveText('101');
  compare(
    await page.locator('canvas[aria-label="Core Path canvas"]').screenshot(),
    full,
  );
  const exports: string[] = [];
  for (const renderer of ['Core', 'ECS']) {
    await page.getByRole('button', { name: `Export ${renderer} PNG` }).click();
    const image = page.getByRole('img', { name: 'Exported Path scene' });
    await expect(toggle).toBeEnabled();
    await expect(image).toBeVisible();
    exports.push((await image.getAttribute('src'))!);
    await toggle.check();
    await page.getByRole('button', { name: `Export ${renderer} PNG` }).click();
    await expect(toggle).toBeEnabled();
    await expect
      .poll(() => image.getAttribute('src'))
      .toBe(exports[exports.length - 1]);
    await toggle.uncheck();
  }
  expect(await page.evaluate(() => window.pathInstancingDemo.nodes())).toEqual(
    nodes,
  );
  await toggle.check();
  await page.getByRole('checkbox', { name: 'Alternating geometry' }).check();
  for (const renderer of ['core', 'ecs'])
    await expect(page.getByTestId(`${renderer}-drawcalls`)).toHaveText('101');
  await page.getByRole('checkbox', { name: 'Alternating geometry' }).uncheck();
  await page
    .getByRole('combobox', { name: 'Paths', exact: true })
    .selectOption('1000');
  for (const renderer of ['core', 'ecs']) {
    await expect(page.getByTestId(`${renderer}-visible`)).toHaveText('1000');
    await expect(page.getByTestId(`${renderer}-drawcalls`)).toHaveText('2');
  }
  await page.getByRole('checkbox', { name: 'Alternating geometry' }).check();
  for (const renderer of ['core', 'ecs'])
    await expect(page.getByTestId(`${renderer}-drawcalls`)).toHaveText('1001');
  await test.info().attach('alternating-1000', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
});

test('Chinese controls fit mobile, select original geometry, and remount without resource growth', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/path-instancing-demo.html?locale=zh');
  const toggle = page.getByRole('checkbox', { name: 'Path 合批' });
  await expect(toggle).toBeEnabled({ timeout: 20000 });
  await expect(page.getByTestId('ecs-visible')).toHaveText('100');
  const resources = () =>
    page.evaluate(() => {
      const latest = new Map<string, Record<string, number>>();
      for (const context of window.lifecycleProbes.resources())
        latest.set(context.side, context.live);
      return Object.fromEntries(latest);
    });
  const baseline = await resources();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const coreCanvas = page
    .getByRole('region', { name: 'Core', exact: true })
    .locator('canvas');
  await coreCanvas.click({ position: { x: 16, y: 16 } });
  await expect
    .poll(async () =>
      Number(await page.getByTestId('core-drawcalls').textContent()),
    )
    .toBeGreaterThan(2);
  await page.getByRole('button', { name: '取消选择' }).click();
  await expect(page.getByTestId('core-drawcalls')).toHaveText('2');
  const canvas = page
    .getByRole('region', { name: 'ECS', exact: true })
    .locator('canvas')
    .first();
  await canvas.click({ position: { x: 16, y: 16 } });
  await expect(page.getByTestId('ecs-selected')).toHaveText('1');
  await page.getByRole('button', { name: '取消选择' }).click();
  await expect(page.getByTestId('ecs-selected')).toHaveText('0');
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 3, bounds.y + 3);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 55, bounds.y + 37);
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(await page.getByTestId('ecs-selected').textContent()),
    )
    .toBeGreaterThan(1);
  await page.getByRole('button', { name: '取消选择' }).click();
  await page.getByRole('button', { name: '平移画布', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '平移画布', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.pathInstancingDemo.unmount());
  await expect(page.locator('#demo')).toBeEmpty();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const baseline = window.pathInstancingDemo.startup();
        return window.lifecycleProbes
          .resources()
          .every((context, index) =>
            Object.entries(context.live).every(
              ([kind, count]) => count === (baseline[index]?.[kind] ?? 0),
            ),
          );
      }),
    )
    .toBe(true);
  expect(await page.evaluate(() => window.pathInstancingDemo.restored())).toBe(
    true,
  );
  await page.evaluate(() => window.pathInstancingDemo.mount());
  await expect(toggle).toBeEnabled({ timeout: 20000 });
  await expect(page.getByTestId('ecs-visible')).toHaveText('100');
  await expect.poll(resources).toEqual(baseline);
  for (const renderer of ['core', 'ecs'])
    await expect(page.getByTestId(`${renderer}-drawcalls`)).toHaveText('2');
});

test('unmount during asynchronous Core setup releases the completed device', async ({
  page,
}) => {
  await page.goto('/path-instancing-demo.html?defer-core');
  await page.waitForFunction(
    () =>
      !!window.pathInstancingDemo &&
      Object.keys(window.pathInstancingDemo.startup()).length > 0,
  );
  await page.evaluate(() => {
    window.pathInstancingDemo.unmount();
    window.pathInstancingDemo.releaseCore();
  });
  await expect(page.locator('#demo')).toBeEmpty();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const baseline = window.pathInstancingDemo.startup();
        return window.lifecycleProbes
          .resources()
          .every((context, index) =>
            Object.entries(context.live).every(
              ([kind, count]) => count === (baseline[index]?.[kind] ?? 0),
            ),
          );
      }),
    )
    .toBe(true);
  expect(await page.evaluate(() => window.pathInstancingDemo.restored())).toBe(
    true,
  );
});
