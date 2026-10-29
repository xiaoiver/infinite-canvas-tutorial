import { expect, test } from '@playwright/test';

for (const locale of ['zh', 'en']) {
  test(`${locale} docs embed an interactive workflow and offer a standalone entry`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      locale === 'zh'
        ? '/zh/example/workflow-canvas'
        : '/example/workflow-canvas',
    );
    const frame = page.frameLocator('iframe');
    await expect(frame.locator('#loading')).toBeHidden({ timeout: 90000 });
    await expect(frame.locator('#node-count')).toHaveText('24');
    const iframe = page
      .frames()
      .find((item) => item.url().endsWith('/workflow-canvas/index.html'))!;
    await iframe.waitForFunction(() => window.workflowDemo?.snapshot().ready);
    expect(
      await iframe.evaluate(() => window.workflowDemo.snapshot().renderedNodes),
    ).toBe(24);
    const before = await frame.locator('#zoom').textContent();
    await frame.locator('#zoom-in').click();
    await expect(frame.locator('#zoom')).not.toHaveText(before!);
    await frame.locator('#scale').selectOption('120');
    await iframe.waitForFunction(() => {
      const state = window.workflowDemo.snapshot();
      return state.ready && state.renderedNodes === 120;
    });
    await expect(frame.locator('#edge-count')).toHaveText('120');
    const standalone = page.getByRole('link', {
      name: locale === 'zh' ? '独立打开' : 'Open standalone',
    });
    await expect(standalone).toHaveAttribute(
      'href',
      '/workflow-canvas/index.html',
    );
    const response = await page.request.get('/workflow-canvas/index.html');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('FRAME — 节点创作工作台');
    expect(errors).toEqual([]);
  });
}
