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
  await page.getByRole('button', { name: 'HTML 预览' }).click();
  const preview = page.frameLocator('iframe[title="生成的 HTML 预览"]');
  await expect(preview.locator('body')).toContainText('Pay $79.00');
  const bounds = await preview.locator('body').evaluate(() => {
    const find = (content: string) => {
      const node = Array.from(document.querySelectorAll('span')).find(
        (span) => span.textContent === content,
      );
      if (!node) throw new Error(`Missing preview text: ${content}`);
      const { top, bottom } = node.getBoundingClientRect();
      return { top, bottom };
    };
    return {
      product: find('Everyday Backpack'),
      variant: find('Indigo · One size'),
      address: find('Shipping address'),
      recipient: find('Maya Chen'),
      summary: find('Order summary'),
      subtotal: find('Subtotal'),
    };
  });
  expect(bounds.product.bottom).toBeLessThanOrEqual(bounds.variant.top);
  expect(bounds.address.bottom).toBeLessThanOrEqual(bounds.recipient.top);
  expect(bounds.summary.bottom).toBeLessThanOrEqual(bounds.subtotal.top);
  await expect(
    page.locator('iframe[title="生成的 HTML 预览"]'),
  ).toHaveAttribute('width', '390');
  await page.getByRole('button', { name: 'React + Tailwind' }).click();
  await expect(page.getByRole('button', { name: 'HTML 预览' })).toBeDisabled();
  await expect(code).toBeVisible();
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
