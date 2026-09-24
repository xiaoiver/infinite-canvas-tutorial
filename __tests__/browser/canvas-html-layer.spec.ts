import { expect, test } from '@playwright/test';

test('the HTML layer origin passes clicks through while editable children remain interactive', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(() => {
    const host = document.createElement('ic-spectrum-canvas');
    host.id = 'html-layer-check';
    host.style.cssText =
      'display:block;position:relative;width:320px;height:300px';
    host.appState = {
      ...host.appState,
      topbarVisible: false,
      cameraZoom: 2,
      cameraX: -40,
      cameraY: -40,
    };
    document.body.append(host);
  });
  const host = page.locator('#html-layer-check');
  const canvas = host.locator('canvas');
  await expect(canvas).toBeVisible();
  await host.scrollIntoViewIfNeeded();
  const point = await host.evaluate((el) => {
    const root = el.shadowRoot!;
    const canvas = root.querySelector('canvas')!;
    canvas.addEventListener(
      'pointerdown',
      () =>
        (el.dataset.canvasClicks = String(
          Number(el.dataset.canvasClicks ?? 0) + 1,
        )),
    );
    const layer = Array.from(root.querySelectorAll('div')).find(
      (d) => d.style.width === '1px' && d.style.height === '1px',
    )!;
    const box = layer.getBoundingClientRect();
    const button = document.createElement('button');
    button.textContent = 'Editable HTML control';
    button.style.cssText =
      'position:absolute;left:20px;top:20px;pointer-events:auto';
    button.addEventListener('click', () => (el.dataset.htmlClicks = '1'));
    layer.append(button);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
  await expect(host).toHaveAttribute('data-canvas-clicks', '1');
  await host.getByRole('button', { name: 'Editable HTML control' }).click();
  await expect(host).toHaveAttribute('data-html-clicks', '1');
  await expect(host).toHaveAttribute('data-canvas-clicks', '1');
  await host.evaluate((el) => el.remove());
  expect(errors).toEqual([]);
});
