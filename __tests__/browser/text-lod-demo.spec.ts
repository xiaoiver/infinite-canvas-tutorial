import { test, expect } from '@playwright/test';
import type {} from './fixtures/text-lod-demo';
import { installProbes } from './fixtures/probes';

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  await page.addInitScript(installProbes);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.textLODDemo?.unmount());
  expect(errors).toEqual([]);
});

test('real documentation controls demonstrate feature-off rendering, hysteresis and selection', async ({
  page,
}) => {
  await page.goto('/text-lod-demo.html');
  const toggle = page.getByRole('checkbox', { name: 'Text LOD' });
  const visible = page.getByTestId('lod-visible'),
    full = page.getByTestId('lod-full'),
    proxy = page.getByTestId('lod-proxy');
  await expect(toggle).toBeEnabled({ timeout: 20_000 });
  await expect(toggle).toBeChecked();
  await expect(proxy).toHaveText('400');
  await test
    .info()
    .attach('overview', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  await page.getByRole('combobox', { name: 'Labels' }).selectOption('100');
  await expect(proxy).toHaveText('100');
  const nodes = await page.evaluate(() => window.textLODDemo.nodes());
  await toggle.uncheck();
  await expect(full).toHaveText('100');
  await expect(proxy).toHaveText('0');
  await toggle.check();
  await expect(proxy).toHaveText('100');
  await page.getByRole('button', { name: '7 px hysteresis band' }).click();
  await expect(full).toHaveText('0');
  await expect
    .poll(async () => Number(await proxy.textContent()))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Detail', exact: true }).click();
  await expect(proxy).toHaveText('0');
  await test
    .info()
    .attach('detail', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  await page.getByRole('button', { name: '7 px hysteresis band' }).click();
  await expect(proxy).toHaveText('0');
  await expect
    .poll(async () => Number(await full.textContent()))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(visible).toHaveText('100');
  await expect(proxy).toHaveText('100');
  await page.getByRole('button', { name: 'Select a visible label' }).click();
  await expect(full).toHaveText('1');
  await expect(proxy).toHaveText('99');
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(proxy).toHaveText('100');
  expect(await page.evaluate(() => window.textLODDemo.nodes())).toEqual(nodes);
});

test('Chinese example fits a narrow viewport and releases its controls on unmount', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/text-lod-demo.html?locale=zh');
  await expect(page.getByRole('checkbox', { name: '文字 LOD' })).toBeEnabled({
    timeout: 20_000,
  });
  await expect(page.getByTestId('lod-proxy')).toHaveText('400');
  const resourceCounts = () =>
    page.evaluate(() => {
      const counts: Record<string, number> = {};
      for (const context of window.lifecycleProbes.resources())
        for (const [kind, count] of Object.entries(context.live))
          counts[kind] = (counts[kind] ?? 0) + count;
      return counts;
    });
  const baseline = await resourceCounts();
  await test
    .info()
    .attach('narrow-layout', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: '平移画布', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '平移画布', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '选中可见文字' }).click();
  await expect(page.getByTestId('lod-full')).toHaveText('1');
  await expect(
    page.getByRole('button', { name: '平移画布', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.evaluate(() => window.textLODDemo.unmount());
  await expect(page.locator('#demo')).toBeEmpty();
  await page.evaluate(() => window.textLODDemo.mount());
  await expect(page.getByTestId('lod-proxy')).toHaveText('400');
  await expect.poll(resourceCounts).toEqual(baseline);
});
