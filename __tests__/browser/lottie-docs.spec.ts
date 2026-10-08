import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/lottie-docs';

test.setTimeout(60000);
test('PolyStar demo renders both shapes and supports frame seeking and reverse playback', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/data/polystar.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: readFileSync(
        'packages/site/docs/public/data/polystar.json',
        'utf8',
      ),
    }),
  );
  await page.goto('/lottie-docs.html?polystar');
  await expect(page.locator('.state')).toContainText('running', {
    timeout: 30000,
  });
  expect(
    await page.evaluate(() => window.lottieDocs.nodes()),
  ).toBeGreaterThanOrEqual(4);
  await expect(page.locator('.compatibility')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  const initial = await page.evaluate(() => window.lottieDocs.paths());
  expect(initial).toHaveLength(2);
  expect(
    initial.every((path) => typeof path === 'string' && path.startsWith('M')),
  ).toBe(true);
  await page.getByRole('slider', { name: 'Seek frame' }).fill('60.25');
  await expect(page.locator('.state')).toContainText('paused');
  await expect(page.locator('output')).toHaveText('60.25');
  expect(await page.evaluate(() => window.lottieDocs.paths())).not.toEqual(
    initial,
  );
  await page.getByRole('button', { name: 'Reverse', exact: true }).click();
  await expect(page.locator('.state')).toContainText('running (reverse)');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.state')).toContainText('stopped');
  expect(await page.evaluate(() => window.lottieDocs.paths())).toEqual(initial);
  await page.evaluate(() => window.lottieDocs.unmount());
  expect(errors).toEqual([]);
});
test('real demos render, expose compatibility notes and remount cleanly', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/data/*.json', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({
      contentType: 'application/json',
      body: readFileSync(`packages/site/docs/public/data/${name}`, 'utf8'),
    });
  });
  await page.goto('/lottie-docs.html');
  await expect(page.locator('.state')).toContainText('running', {
    timeout: 30000,
  });
  expect(await page.evaluate(() => window.lottieDocs.nodes())).toBeGreaterThan(
    0,
  );
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.state')).toContainText('stopped');
  await page.evaluate(() => window.lottieDocs.unmount());
  await page.evaluate(() => window.lottieDocs.mount(true));
  await expect(page.locator('.state')).toContainText('running', {
    timeout: 20000,
  });
  await expect(page.locator('summary')).toContainText('Compatibility notes');
  await page.locator('summary').click();
  await expect(page.locator('.compatibility')).toContainText(
    'baked at import time',
  );
  expect(await page.evaluate(() => window.lottieDocs.nodes())).toBeGreaterThan(
    0,
  );
  await page.evaluate(() => window.lottieDocs.unmount());
  expect(errors).toEqual([]);
});

test('unmount aborts an in-flight example request before it can queue a render', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let received!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page.route('**/data/bouncy_ball.json', () => {
    received();
  });
  await page.goto('/lottie-docs.html');
  await requestStarted;
  await page.evaluate(() => window.lottieDocs.unmount());
  await expect
    .poll(() => page.evaluate(() => window.lottieDocs.cancelled()))
    .toContain('/data/bouncy_ball.json');
  expect(await page.evaluate(() => window.lottieDocs.nodes())).toBe(0);
  expect(errors).toEqual([]);
});

test('Repeater demo seeks and reverses without changing its node pool, then unmounts cleanly', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/data/repeater.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: readFileSync(
        'packages/site/docs/public/data/repeater.json',
        'utf8',
      ),
    }),
  );
  await page.goto('/lottie-docs.html?repeater');
  await expect(page.locator('.state')).toContainText('running', {
    timeout: 30000,
  });
  await expect(page.locator('.compatibility')).toHaveCount(0);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  const initial = await page.evaluate(() => ({
    count: window.lottieDocs.nodes(),
    values: window.lottieDocs.values(),
  }));
  expect(initial.count).toBeGreaterThan(8);
  await page.getByRole('slider', { name: 'Seek frame' }).fill('60.25');
  await expect(page.locator('.state')).toContainText('paused');
  await expect(page.locator('output')).toHaveText('60.25');
  expect(await page.evaluate(() => window.lottieDocs.values())).not.toEqual(
    initial.values,
  );
  expect(await page.evaluate(() => window.lottieDocs.nodes())).toBe(
    initial.count,
  );
  await page.getByRole('button', { name: 'Reverse', exact: true }).click();
  await expect(page.locator('.state')).toContainText('running (reverse)');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  expect(await page.evaluate(() => window.lottieDocs.values())).toEqual(
    initial.values,
  );
  await page.evaluate(() => window.lottieDocs.unmount());
  await expect
    .poll(() => page.evaluate(() => window.lottieDocs.nodes()))
    .toBe(0);
  expect(errors).toEqual([]);
});
