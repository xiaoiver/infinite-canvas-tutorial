import { test, expect } from '@playwright/test';

for (const zh of [false, true]) {
  test(`built ${
    zh ? 'Chinese mobile' : 'English'
  } Path example initializes both renderers`, async ({ page }, info) => {
    if (zh) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => {
      if (
        request.url().startsWith('http://127.0.0.1:4181/') &&
        /\.(js|wasm)(\?|$)/.test(request.url())
      )
        errors.push(`${request.url()}: ${request.failure()?.errorText}`);
    });
    const response = await page.goto(
      `${zh ? '/zh' : ''}/example/path-instancing`,
    );
    expect(response?.status()).toBe(200);
    const toggle = page.getByRole('checkbox', {
      name: zh ? 'Path 合批' : 'Path instancing',
      exact: true,
    });
    await expect(toggle).toBeEnabled({ timeout: 30000 });
    for (const renderer of ['core', 'ecs']) {
      await expect(page.getByTestId(`${renderer}-visible`)).toHaveText('100');
      await expect(page.getByTestId(`${renderer}-drawcalls`)).toHaveText('2');
    }
    await toggle.uncheck();
    for (const renderer of ['core', 'ecs'])
      await expect(page.getByTestId(`${renderer}-drawcalls`)).toHaveText('101');
    await toggle.check();
    await page
      .getByRole('checkbox', { name: zh ? '交替几何' : 'Alternating geometry' })
      .check();
    for (const renderer of ['core', 'ecs'])
      await expect(page.getByTestId(`${renderer}-drawcalls`)).toHaveText('101');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await info.attach('built-path-example', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    expect(errors).toEqual([]);
  });
}
