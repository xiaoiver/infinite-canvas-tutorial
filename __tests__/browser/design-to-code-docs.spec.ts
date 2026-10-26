import { expect, test } from '@playwright/test';
import type {} from './fixtures/design-to-code-docs';

test('mobile checkout stays editable on the IC canvas and exports current HTML and React', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/design-to-code-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.designToCodeDocs.scene()), {
      timeout: 30000,
    })
    .toBe('dashboard');
  await page.getByRole('button', { name: '移动端结账页' }).click();
  await expect
    .poll(() => page.evaluate(() => window.designToCodeDocs.scene()))
    .toBe('checkout-screen');
  const nodes = await page.evaluate(() => window.designToCodeDocs.nodes());
  const artboard = nodes.find((node) => node.id === 'checkout-screen');
  expect(artboard).toMatchObject({ type: 'rect', width: 390, height: 844 });
  expect(nodes.length).toBeGreaterThan(35);
  const code = page.locator('.interface-demo-code');
  await expect(code).toContainText('Review your order');
  await expect(code).toContainText('Pay $89.00');
  await expect(code.locator('.shiki')).toBeVisible();

  await page.evaluate(() => window.designToCodeDocs.editPay('Pay $79.00'));
  await expect(code).toContainText('Pay $79.00');
  await page.getByRole('button', { name: 'React + Tailwind' }).click();
  await expect(code).toContainText('CheckoutScreen');
  await expect(code).toContainText('Pay $79.00');
  await page.getByRole('button', { name: '订阅定价页' }).click();
  await expect
    .poll(() => page.evaluate(() => window.designToCodeDocs.scene()))
    .toBe('pricing-page');
  await expect(code).toContainText('PricingPage');
  await page.getByRole('button', { name: '运营数据面板' }).click();
  await expect
    .poll(() => page.evaluate(() => window.designToCodeDocs.scene()))
    .toBe('dashboard');
  await expect(code).toContainText('AnalyticsDashboard');
  expect(errors).toEqual([]);
});
