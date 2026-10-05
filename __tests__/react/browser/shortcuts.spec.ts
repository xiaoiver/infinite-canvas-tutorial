import { expect, test } from '@playwright/test';

for (const locale of ['en', 'zh']) {
  test(`documentation shortcuts isolate canvases and keep one edit per key (${locale})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/?playground=${locale}`);
    const left = page.locator('[data-canvas="A"]');
    const right = page.locator('[data-canvas="B"]');
    await expect(left.locator('[data-action="add"]')).toBeEnabled({
      timeout: 45000,
    });
    await expect(right.locator('[data-action="add"]')).toBeEnabled();
    await left.locator('ic-spectrum-canvas').evaluate((element) => {
      element.dataset.nativeKeys = '0';
      (element as HTMLElement).addEventListener('keydown', (event) => {
        if (
          !['a', 'z', 'delete', 'backspace'].includes(event.key.toLowerCase())
        )
          return;
        element.dataset.nativeKeys = String(
          Number(element.dataset.nativeKeys) + 1,
        );
      });
    });
    // A sibling React control owns focus; no pointer activation is required.
    await left.locator('[data-action="add"]').focus();
    await page.keyboard.press('Control+a');
    await expect(left.locator('[data-state="selected"]')).toHaveText('2');
    await expect(right.locator('[data-state="selected"]')).toHaveText('0');
    await expect(left.locator('[data-action="undo"]')).toBeDisabled();
    await page.keyboard.press('Delete');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('0');
    await expect(right.locator('[data-state="nodes"]')).toHaveText('2');
    await page.keyboard.press('Control+z');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(left.locator('[data-action="undo"]')).toBeDisabled();
    await page.keyboard.press('Control+Shift+z');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('0');
    await page.keyboard.press('Meta+z');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await page.keyboard.press('Control+y');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('0');
    await page.keyboard.press('Control+z');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');

    // Focus inside the native canvas: capture must stop duplicate native handlers.
    await left.locator('canvas').focus();
    await expect(left.locator('canvas')).toBeFocused();
    await page.keyboard.press('Meta+a');
    await expect(left.locator('[data-state="selected"]')).toHaveText('2');
    await page.keyboard.press('Backspace');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('0');
    await page.keyboard.press('Meta+z');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(left.locator('[data-action="undo"]')).toBeDisabled();
    await page.keyboard.press('Meta+Shift+z');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('0');
    await expect(left.locator('ic-spectrum-canvas')).toHaveAttribute(
      'data-native-keys',
      '0',
    );
    await expect(right.locator('[data-action="undo"]')).toBeDisabled();

    // The other Provider acquires shortcuts by keyboard focus alone.
    await right.focus();
    await page.keyboard.press('Control+a');
    await expect(right.locator('[data-state="selected"]')).toHaveText('2');
    await page.keyboard.press('Delete');
    await expect(right.locator('[data-state="nodes"]')).toHaveText('0');
    await page.keyboard.press('Control+z');
    await expect(right.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(left.locator('[data-state="nodes"]')).toHaveText('0');
    expect(errors).toEqual([]);
  });
}

test('real shadow inputs retain text shortcuts and queued selection/deletion uses current state', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await page.evaluate(() => {
    const scope = document.querySelector('[data-testid="left-shortcuts"]')!;
    const shadowHost = document.createElement('div');
    shadowHost.id = 'shortcut-input';
    const root = shadowHost.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.value = 'Keep typing';
    root.append(input);
    scope.append(shadowHost);
  });
  const input = page.locator('#shortcut-input input');
  await input.focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await expect(input).toHaveValue('');
  await expect(page.getByTestId('left-count')).toHaveText('1');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  // Dispatch both keys before the ECS edit stage executes either command.
  await page.evaluate(() => {
    const scope = document.querySelector('[data-testid="left-shortcuts"]')!;
    scope.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    scope.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Delete',
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.getByTestId('left-count')).toHaveText('0');
  await page.getByTestId('left-shortcuts').focus();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('left-count')).toHaveText('1');
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  expect(await page.evaluate(() => window.canvasErrors)).toEqual([]);
  expect(errors).toEqual([]);
});
