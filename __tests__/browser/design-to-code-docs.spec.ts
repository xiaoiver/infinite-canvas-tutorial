import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type {} from './fixtures/design-to-code-docs';

test('mobile checkout stays editable on the IC canvas and exports current HTML and React', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /ERROR:|program not valid|WebGL: INVALID_OPERATION/.test(message.text())
    )
      errors.push(message.text());
  });
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
  await expect(preview.getByRole('main')).toBeVisible();
  await expect(
    preview.getByRole('button', { name: /Pay \$79\.00/ }),
  ).toBeVisible();
  await expect(
    preview.getByRole('heading', { name: 'Checkout' }),
  ).toBeVisible();
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
  await expect(code).toContainText('<button type="button"');
  await page.getByRole('button', { name: '订阅定价页' }).click();
  await expect
    .poll(() => page.evaluate(() => window.designToCodeDocs.scene()))
    .toBe('pricing-page');
  await expect(code).toContainText('PricingPage');
  await expect(code).toContainText('export function PricingPlanCard');
  await expect(code).not.toContainText('pricingPlanCardOpacity');
  expect((await code.innerText()).match(/<PricingPlanCard/g)).toHaveLength(3);
  await page.evaluate(() => window.designToCodeDocs.editPricingAmount('$39'));
  await expect(code).toContainText('$39');
  await expect(code).toContainText('export function PricingPlanCard');
  const [componentDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 .ic' }).click(),
  ]);
  const componentDocument = JSON.parse(
    await readFile((await componentDownload.path())!, 'utf8'),
  );
  expect(
    componentDocument.elements.find(
      (node: { id: string }) => node.id === 'plan-growth',
    ),
  ).toMatchObject({
    type: 'ref',
    descendants: { 'plan-card-amount': { content: '$39' } },
  });
  await page.evaluate(() => window.designToCodeDocs.resizePricingCard(320));
  await expect(code).toContainText('export function PricingPlanCard');
  await expect(code).toContainText('pricingPlanCardWidth={320}');
  await expect(code).toContainText('pricingPlanCardStrokeWidth={2}');
  const [resizedDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 .ic' }).click(),
  ]);
  const resizedDocument = JSON.parse(
    await readFile((await resizedDownload.path())!, 'utf8'),
  );
  expect(
    resizedDocument.elements.find(
      (node: { id: string }) => node.id === 'plan-growth',
    ),
  ).toMatchObject({ type: 'ref', width: 320, strokeWidth: 2 });
  await page.evaluate(() => window.designToCodeDocs.setPricingCardOpacity(0.7));
  await page.evaluate(() =>
    window.designToCodeDocs.setPricingAmountWeight(800),
  );
  await page.evaluate(() =>
    window.designToCodeDocs.setPricingAmountTypography(),
  );
  await page.evaluate(() =>
    window.designToCodeDocs.setPricingAmountDecoration(),
  );
  await page.evaluate(() =>
    window.designToCodeDocs.setPricingAmountFontFeatures(),
  );
  await expect(code).toContainText('export function PricingPlanCard');
  await expect(code).toContainText('pricingPlanCardOpacity={0.70}');
  await expect(code).toContainText('planCardAmountFontWeight={800}');
  await expect(code).toContainText('planCardAmountFontStyle="italic"');
  await expect(code).toContainText('planCardAmountFontFamily="Georgia"');
  await expect(code).toContainText('planCardAmountTextAlign="center"');
  await expect(code).toContainText('planCardAmountLetterSpacing={1.50}');
  await expect(code).toContainText('planCardAmountLineHeight={48}');
  await expect(code).toContainText(
    'planCardAmountTextDecoration="wavy underline #ffcc66 2px"',
  );
  await expect(code).toContainText('planCardAmountFontVariant="small-caps"');
  await expect(code).toContainText('planCardAmountFontKerning="none"');
  const [styledDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 .ic' }).click(),
  ]);
  const styledDocument = JSON.parse(
    await readFile((await styledDownload.path())!, 'utf8'),
  );
  expect(
    styledDocument.elements.find(
      (node: { id: string }) => node.id === 'plan-growth',
    ),
  ).toMatchObject({
    type: 'ref',
    width: 320,
    opacity: 0.7,
    descendants: {
      'plan-card-amount': {
        fontWeight: 800,
        fontStyle: 'italic',
        fontFamily: 'Georgia',
        textAlign: 'center',
        letterSpacing: 1.5,
        lineHeight: 48,
        decorationLine: 'underline',
        decorationStyle: 'wavy',
        decorationColor: '#ffcc66',
        decorationThickness: 2,
        fontVariant: 'small-caps',
        fontKerning: false,
        anchorX: expect.any(Number),
      },
    },
  });
  expect(
    styledDocument.elements.find(
      (node: { id: string }) => node.id === 'plan-growth',
    ).descendants['plan-card-amount'].anchorX,
  ).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'HTML/CSS' }).click();
  await expect(code).toContainText('opacity: 0.70');
  await expect(code).toContainText('font-weight: 800');
  await expect(code).toContainText('font-style: italic');
  await expect(code).toContainText('font-family: Georgia');
  await expect(code).toContainText('text-align: center');
  await expect(code).toContainText('letter-spacing: 1.50px');
  await expect(code).toContainText('line-height: 48px');
  await expect(code).toContainText(
    'text-decoration: wavy underline #ffcc66 2px',
  );
  await expect(code).toContainText('font-variant: small-caps');
  await expect(code).toContainText('font-kerning: none');
  await page.getByRole('button', { name: 'React + Tailwind' }).click();
  await page.evaluate(() => window.designToCodeDocs.setPricingCardShadow());
  await expect(code).toContainText('export function PricingPlanCard');
  await expect(code).toContainText(
    'pricingPlanCardDropShadow="0px 6px 12px #000000"',
  );
  const [shadowDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 .ic' }).click(),
  ]);
  const shadowDocument = JSON.parse(
    await readFile((await shadowDownload.path())!, 'utf8'),
  );
  expect(
    shadowDocument.elements.find(
      (node: { id: string }) => node.id === 'plan-growth',
    ),
  ).toMatchObject({
    type: 'ref',
    dropShadowColor: '#000000',
    dropShadowOffsetY: 6,
    dropShadowBlurRadius: 12,
  });
  await page.getByRole('button', { name: 'HTML/CSS' }).click();
  await expect(code).toContainText('box-shadow: 0px 6px 12px #000000');
  await page.getByRole('button', { name: 'React + Tailwind' }).click();
  await page.evaluate(() => window.designToCodeDocs.setPricingCardPadding(20));
  await expect(code).toContainText('export function PricingPlanCard');
  await expect(code).toContainText('pricingPlanCardPadding="20px"');
  const [spacingDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 .ic' }).click(),
  ]);
  const spacingDocument = JSON.parse(
    await readFile((await spacingDownload.path())!, 'utf8'),
  );
  expect(
    spacingDocument.elements.find(
      (node: { id: string }) => node.id === 'plan-growth',
    ),
  ).toMatchObject({ type: 'ref', padding: 20 });
  await page.getByRole('button', { name: 'HTML/CSS' }).click();
  await expect(code).toContainText('padding: 20px');
  await page.getByRole('button', { name: 'React + Tailwind' }).click();
  await page.evaluate(() =>
    window.designToCodeDocs.setPricingCardJustification(),
  );
  await expect(code).toContainText('export function PricingPlanCard');
  await expect(code).toContainText(
    'pricingPlanCardJustifyContent="space-between"',
  );
  const [expandedDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 .ic' }).click(),
  ]);
  const alignedDocument = JSON.parse(
    await readFile((await expandedDownload.path())!, 'utf8'),
  );
  expect(
    alignedDocument.elements.find(
      (node: { id: string }) => node.id === 'plan-growth',
    ),
  ).toMatchObject({
    type: 'ref',
    width: 320,
    opacity: 0.7,
    padding: 20,
    justifyContent: 'space-between',
    dropShadowBlurRadius: 12,
  });
  await page.evaluate(() => window.designToCodeDocs.setPricingPriceFlexItem());
  await expect(code).toContainText('export function PricingPlanCard');
  await expect(code).toContainText('planCardPriceFlexBasis={140}');
  await expect(code).toContainText('planCardPriceFlexGrow={1}');
  const [flexDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 .ic' }).click(),
  ]);
  const flexDocument = JSON.parse(
    await readFile((await flexDownload.path())!, 'utf8'),
  );
  expect(
    flexDocument.elements.find(
      (node: { id: string }) => node.id === 'plan-growth',
    ),
  ).toMatchObject({
    type: 'ref',
    descendants: {
      'plan-card-price': {
        alignSelf: 'center',
        flexGrow: 1,
        flexShrink: 0,
        flexBasis: 140,
      },
    },
  });
  await page.evaluate(() =>
    window.designToCodeDocs.setPricingActionConstraints(),
  );
  await expect(code).toContainText('export function PricingPlanCard');
  await expect(code).toContainText('planCardActionMinWidth={250}');
  await expect(code).toContainText('planCardActionMaxHeight={52}');
  const [constraintsDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 .ic' }).click(),
  ]);
  const constrainedDocument = JSON.parse(
    await readFile((await constraintsDownload.path())!, 'utf8'),
  );
  expect(
    constrainedDocument.elements.find(
      (node: { id: string }) => node.id === 'plan-growth',
    ),
  ).toMatchObject({
    type: 'ref',
    descendants: {
      'plan-card-action': {
        minWidth: 250,
        maxWidth: 300,
        minHeight: 40,
        maxHeight: 52,
      },
    },
  });
  await page.evaluate(() => window.designToCodeDocs.setPricingCardBlendMode());
  await expect(code).toContainText('export function PricingPlanCard');
  await expect(code).toContainText('pricingPlanCardBlendMode="multiply"');
  const [blendDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 .ic' }).click(),
  ]);
  const blendedDocument = JSON.parse(
    await readFile((await blendDownload.path())!, 'utf8'),
  );
  expect(
    blendedDocument.elements.find(
      (node: { id: string }) => node.id === 'plan-growth',
    ),
  ).toMatchObject({ type: 'ref', blendMode: 'multiply' });
  await page.getByRole('button', { name: 'HTML/CSS' }).click();
  await expect(code).toContainText('flex-basis: 140px');
  await expect(code).toContainText('align-self: center');
  await expect(code).toContainText('min-width: 250px');
  await expect(code).toContainText('max-height: 52px');
  await expect(code).toContainText('mix-blend-mode: multiply');
  await page.getByRole('button', { name: 'React + Tailwind' }).click();
  await page.evaluate(() => window.designToCodeDocs.setPricingAmountWrap());
  await expect(code).toContainText('whitespace-pre-wrap');
  await expect(code).toContainText('max-w-[140px]');
  await page.getByRole('button', { name: 'HTML/CSS' }).click();
  await expect(code).toContainText('white-space: pre-wrap');
  await expect(code).toContainText('max-width: 140px');
  await page.getByRole('button', { name: 'React + Tailwind' }).click();
  await page.getByRole('button', { name: '运营数据面板' }).click();
  await expect
    .poll(() => page.evaluate(() => window.designToCodeDocs.scene()))
    .toBe('dashboard');
  await expect(code).toContainText('AnalyticsDashboard');
  await page.evaluate(() => window.designToCodeDocs.setZoom(0.3));
  await expect
    .poll(() =>
      page.evaluate(() => window.designToCodeDocs.camera()?.cameraZoom),
    )
    .toBeCloseTo(0.3);
  expect(errors).toEqual([]);
});
