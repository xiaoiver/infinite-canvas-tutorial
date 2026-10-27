import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import * as ts from 'typescript';
import type {} from './fixtures/design-to-code-docs';
import type {} from './fixtures/react-code-output';

test('generated React renders the three editable interface examples', async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const { compile } = await import(
    '../../packages/app/node_modules/tailwindcss/dist/lib.mjs'
  );
  const preflight = await readFile(
    'packages/app/node_modules/tailwindcss/preflight.css',
    'utf8',
  );
  await page.goto('/design-to-code-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.designToCodeDocs.scene()), {
      timeout: 30000,
    })
    .toBe('dashboard');
  const reactPage = await context.newPage();
  const runtimeErrors: string[] = [];
  reactPage.on('pageerror', (error) => runtimeErrors.push(error.message));
  reactPage.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await reactPage.goto('/react-code-output.html');
  await expect
    .poll(() => reactPage.evaluate(() => typeof window.renderGeneratedCode))
    .toBe('function');

  for (const [label, id, component, texts] of [
    [
      '运营数据面板',
      'dashboard',
      'AnalyticsDashboard',
      ['Overview', '↗  12.8% from last month', 'Mon', 'Recent activity'],
    ],
    [
      '订阅定价页',
      'pricing-page',
      'PricingPage',
      ['A plan for every ambition', 'Growth', 'Choose Growth'],
    ],
    [
      '移动端结账页',
      'checkout-screen',
      'CheckoutScreen',
      [
        'Checkout',
        'Everyday Backpack',
        'Secure checkout · Payments are encrypted',
      ],
    ],
  ] as const) {
    await page.getByRole('button', { name: label }).click();
    await expect
      .poll(() => page.evaluate(() => window.designToCodeDocs.scene()))
      .toBe(id);
    await page.getByRole('button', { name: 'HTML/CSS' }).click();
    await page.getByRole('button', { name: 'HTML 预览' }).click();
    const html = page.frameLocator('iframe[title="生成的 HTML 预览"]');
    await expect(
      html.getByText(texts[0], { exact: true }).first(),
    ).toBeVisible();
    const htmlPositions = await html
      .locator('body')
      .evaluate((body, labels) => {
        const root = body.querySelector('div, main');
        if (!root) throw new Error('Missing HTML preview root');
        const origin = root.getBoundingClientRect();
        return labels.map((text) => {
          const element = Array.from(body.querySelectorAll('*')).find(
            (candidate) =>
              candidate.children.length === 0 &&
              candidate.textContent?.trim() === text,
          );
          if (!element) throw new Error(`Missing HTML text: ${text}`);
          const rect = element.getBoundingClientRect();
          return { x: rect.x - origin.x, y: rect.y - origin.y };
        });
      }, texts);

    await page.getByRole('button', { name: 'React + Tailwind' }).click();
    const code = page.locator('.interface-demo-code pre code');
    await expect(code).toContainText(`export function ${component}`);
    const source = await code.textContent();
    if (!source) throw new Error(`Missing generated React source: ${id}`);
    const output = ts.transpileModule(source, {
      fileName: `${component}.tsx`,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    expect(
      output.diagnostics?.filter(
        (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
      ),
    ).toEqual([]);
    const candidates = Array.from(source.matchAll(/className="([^"]+)"/g))
      .flatMap((match) => match[1].split(/\s+/))
      .filter(Boolean);
    const tailwind = await compile(`${preflight}\n@tailwind utilities;`);
    const css = tailwind.build(candidates);
    await reactPage.evaluate(
      ({ js, css, component }) =>
        window.renderGeneratedCode(js, css, component),
      { js: output.outputText, css, component },
    );
    const reactPositions = await reactPage
      .locator('#root')
      .evaluate((root, labels) => {
        const origin = root.firstElementChild?.getBoundingClientRect();
        if (!origin) throw new Error('Missing generated React root');
        return labels.map((text) => {
          const element = Array.from(root.querySelectorAll('*')).find(
            (candidate) =>
              candidate.children.length === 0 &&
              candidate.textContent?.trim() === text,
          );
          if (!element) throw new Error(`Missing React text: ${text}`);
          const rect = element.getBoundingClientRect();
          return { x: rect.x - origin.x, y: rect.y - origin.y };
        });
      }, texts);
    for (const [index, text] of texts.entries()) {
      expect(
        Math.abs(reactPositions[index].x - htmlPositions[index].x),
        text,
      ).toBeLessThan(4);
      expect(
        Math.abs(reactPositions[index].y - htmlPositions[index].y),
        text,
      ).toBeLessThan(8);
    }
    expect(runtimeErrors, id).toEqual([]);
  }
});
