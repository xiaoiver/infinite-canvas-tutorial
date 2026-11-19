import { test, expect } from '@playwright/test';

for (const zh of [false, true]) {
  test(`built ${
    zh ? 'Chinese mobile' : 'English'
  } LOD page initializes and remains interactive`, async ({ page }, info) => {
    if (zh) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
      console.error(error.stack);
    });
    page.on('requestfailed', (request) => {
      if (
        request.url().startsWith('http://127.0.0.1:4181/') &&
        /\.(js|wasm)(\?|$)/.test(request.url())
      )
        errors.push(`${request.url()}: ${request.failure()?.errorText}`);
    });
    const response = await page.goto(`${zh ? '/zh' : ''}/example/text-lod`);
    expect(response?.status()).toBe(200);
    const toggle = page.getByRole('checkbox', {
      name: zh ? '文字 LOD' : 'Text LOD',
      exact: true,
    });
    const full = page.getByTestId('lod-full'),
      proxy = page.getByTestId('lod-proxy');
    await expect(toggle).toBeEnabled({ timeout: 30000 });
    await expect(proxy).toHaveText('400');
    await toggle.uncheck();
    // Cold restoration creates 400 glyph renderers (7.4s in the production CI trace).
    await expect(full).toHaveText('400', { timeout: 15000 });
    await expect(proxy).toHaveText('0');
    await toggle.check();
    await expect(proxy).toHaveText('400');
    await page
      .getByRole('button', {
        name: zh ? '7 px 滞回区间' : '7 px hysteresis band',
        exact: true,
      })
      .click();
    await expect(full).toHaveText('0');
    await expect
      .poll(async () => Number(await proxy.textContent()))
      .toBeGreaterThan(0);
    await page
      .getByRole('button', { name: zh ? '查看细节' : 'Detail', exact: true })
      .click();
    await expect(proxy).toHaveText('0');
    await page
      .getByRole('button', {
        name: zh ? '7 px 滞回区间' : '7 px hysteresis band',
        exact: true,
      })
      .click();
    await expect(proxy).toHaveText('0');
    await expect
      .poll(async () => Number(await full.textContent()))
      .toBeGreaterThan(0);
    await page
      .getByRole('button', { name: zh ? '总览' : 'Overview', exact: true })
      .click();
    await expect(proxy).toHaveText('400');
    await page
      .getByRole('button', {
        name: zh ? '选中可见文字' : 'Select a visible label',
        exact: true,
      })
      .click();
    await expect(full).toHaveText('1');
    await page
      .getByRole('button', {
        name: zh ? '取消选择' : 'Clear selection',
        exact: true,
      })
      .click();
    await expect(proxy).toHaveText('400');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await info.attach('built-page', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    expect(errors).toEqual([]);
  });
}
