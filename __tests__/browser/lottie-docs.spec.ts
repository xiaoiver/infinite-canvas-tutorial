import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/lottie-docs';

test.setTimeout(60000);
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
