import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import type {} from './fixtures/design-to-code-docs';

test('paint overlays render opacity, image scale-down and pattern transforms', async ({
  page,
}) => {
  await page.goto('/design-to-code-docs.html');
  await expect
    .poll(
      () => page.evaluate(() => typeof window.designToCodeDocs?.paintMarkup),
      {
        timeout: 30000,
      },
    )
    .toBe('function');
  const markup = await page.evaluate(() => ({
    opacity: window.designToCodeDocs.paintMarkup('opacity'),
    image: window.designToCodeDocs.paintMarkup('scale-down'),
    pattern: window.designToCodeDocs.paintMarkup('pattern'),
    rotated: window.designToCodeDocs.paintMarkup('pattern-rotate'),
  }));
  const sample = async (html: string, x: number, y: number) => {
    await page.setContent(html);
    await page.addStyleTag({ content: 'body { margin: 0; }' });
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images, (image) => image.decode().catch(() => {})),
      ),
    );
    const png = PNG.sync.read(await page.screenshot());
    const offset = (y * png.width + x) * 4;
    return [...png.data.slice(offset, offset + 3)];
  };
  const mixed = await sample(markup.opacity, 30, 30);
  expect(mixed[0]).toBeGreaterThan(100);
  expect(mixed[2]).toBeGreaterThan(100);
  expect(mixed[1]).toBeLessThan(20);
  expect(await sample(markup.image, 30, 30)).toEqual([0, 255, 0]);
  expect(await sample(markup.image, 5, 5)).toEqual([255, 0, 0]);
  expect(await sample(markup.pattern, 11, 11)).toEqual([0, 255, 0]);
  expect(await sample(markup.pattern, 5, 5)).toEqual([255, 0, 0]);
  expect(await sample(markup.rotated, 35, 4)).toEqual([0, 255, 0]);
  expect(await sample(markup.rotated, 5, 5)).toEqual([255, 0, 0]);
});

test('all three editable interface scenes render populated HTML previews', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/design-to-code-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.designToCodeDocs.scene()), {
      timeout: 30000,
    })
    .toBe('dashboard');

  for (const [label, id, heading, width, parityIds] of [
    [
      '运营数据面板',
      'dashboard',
      'Overview',
      1050,
      ['brand', 'metric-revenue-trend', 'day-Mon', 'activity-heading'],
    ],
    [
      '订阅定价页',
      'pricing-page',
      'A plan for every ambition',
      1050,
      ['pricing-brand', 'hero-title', 'plan-growth__plan-card-name'],
    ],
    [
      '移动端结账页',
      'checkout-screen',
      'Checkout',
      390,
      [
        'checkout-product-variant',
        'checkout-shipping-label',
        'checkout-security-label',
      ],
    ],
  ] as const) {
    const tab = page.getByRole('button', { name: label });
    await tab.click();
    await expect
      .poll(() => page.evaluate(() => window.designToCodeDocs.scene()))
      .toBe(id);
    await expect(tab).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'HTML 预览' }).click();
    const iframe = page.locator('iframe[title="生成的 HTML 预览"]');
    await expect(iframe).toHaveAttribute('width', String(width));
    const preview = page.frameLocator('iframe[title="生成的 HTML 预览"]');
    await expect(preview.getByRole('heading', { name: heading })).toBeVisible();
    await expect(preview.getByRole('button').first()).toBeVisible();
    const canvasPositions = await page.evaluate((ids) => {
      const nodes = window.designToCodeDocs.nodes();
      return ids.map((id) => {
        const node = nodes.find((item) => item.id === id);
        const bounds = window.designToCodeDocs.nodeBounds(id);
        if (node?.type !== 'text' || !bounds)
          throw new Error(`Missing canvas text: ${id}`);
        return { id, text: node.content, x: bounds.minX, y: bounds.minY };
      });
    }, parityIds);
    const previewPositions = await preview
      .locator('body')
      .evaluate((body, expected) => {
        const root = Array.from(body.children).find(
          (element) => element instanceof HTMLElement,
        );
        if (!root) throw new Error('Missing preview root');
        const origin = root.getBoundingClientRect();
        return expected.map(({ id, text }) => {
          const element = Array.from(body.querySelectorAll('*')).find(
            (candidate) =>
              candidate.children.length === 0 &&
              candidate.textContent?.trim() === text.trim(),
          );
          if (!element) throw new Error(`Missing preview text: ${id}`);
          const rect = element.getBoundingClientRect();
          return { x: rect.x - origin.x, y: rect.y - origin.y };
        });
      }, canvasPositions);
    for (const [index, canvas] of canvasPositions.entries()) {
      const previewText = previewPositions[index];
      expect(Math.abs(previewText.x - canvas.x), canvas.id).toBeLessThan(3);
      expect(Math.abs(previewText.y - canvas.y), canvas.id).toBeLessThan(8);
    }
    const png = PNG.sync.read(await iframe.screenshot({ scale: 'css' }));
    let painted = 0;
    const colors = new Set<number>();
    for (let i = 0; i < png.data.length; i += 16) {
      const rgb =
        (png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2];
      if (rgb !== 0xffffff) painted++;
      colors.add(rgb);
    }
    expect(painted).toBeGreaterThan((png.width * png.height) / 40);
    expect(colors.size).toBeGreaterThan(20);
  }
});

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
  await expect(code).toContainText('planCardActionFills="#7969f5"');
  await expect(code).not.toContainText(
    'planCardActionFills="$color.highlight"',
  );
  await expect(code).not.toContainText('pricingPlanCardOpacity');
  expect((await code.innerText()).match(/<PricingPlanCard/g)).toHaveLength(3);
  await page.evaluate(() => window.designToCodeDocs.editPricingAmount('$39'));
  await expect(code).toContainText('$39');
  await expect(code).toContainText('export function PricingPlanCard');
  const [projectDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 React 工程' }).click(),
  ]);
  expect(projectDownload.suggestedFilename()).toBe('pricing-react.zip');
  const { unzipSync, strFromU8 } = await import(
    '../../packages/site/node_modules/fflate/esm/index.mjs'
  );
  const project = unzipSync(
    new Uint8Array(await readFile((await projectDownload.path())!)),
  );
  const appSource = strFromU8(project['src/App.tsx']);
  expect(appSource).toContain('export function PricingPlanCard');
  expect(appSource).toContain('$39');
  const mainSource = strFromU8(project['src/main.tsx']);
  expect(mainSource).toContain('<PricingPage />');
  expect(mainSource).toContain('ic-starter--pricing');
  expect(mainSource).toContain("import './responsive.css'");
  expect(mainSource).toContain("import '@fontsource/inter/400.css'");
  expect(mainSource).toContain("import '@fontsource/inter/700.css'");
  expect(strFromU8(project['src/responsive.css'])).toContain(
    '.ic-starter--pricing section { flex-direction: column',
  );
  expect(strFromU8(project['src/index.css'])).toContain(
    '@import "tailwindcss"',
  );
  const manifest = JSON.parse(strFromU8(project['package.json']));
  expect(manifest.scripts.build).toBe('tsc --noEmit && vite build');
  expect(manifest.dependencies).toMatchObject({
    react: '19.2.3',
    'react-dom': '19.2.3',
    '@fontsource/inter': '5.3.0',
  });
  expect(manifest.devDependencies).toHaveProperty('tailwindcss');
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
