import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    imageProbe: {
      source: string;
      results: string[];
      masks: HTMLCanvasElement[];
      jobs: {
        kind: string;
        input: unknown;
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
      }[];
    };
  }
}

export async function ready(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  await page.evaluate(async () => {
    const image = (color: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 2, 2);
      return canvas.toDataURL();
    };
    window.imageProbe = {
      source: image('red'),
      results: [image('blue'), image('green')],
      jobs: [],
      masks: [],
    };
    const pending = <T>(kind: string, input: unknown) =>
      new Promise<T>((resolve, reject) => {
        window.imageProbe.jobs.push({
          kind,
          input,
          resolve: (value) => resolve(value as T),
          reject,
        });
      });
    const api = window.apis.left;
    api.capabilities.register(
      'createOrEditImage',
      'test',
      (isEdit, prompt, urls) => pending('background', { isEdit, prompt, urls }),
    );
    api.capabilities.register('upscaleImage', 'test', (input) =>
      pending('upscale', input),
    );
    api.capabilities.register('decomposeImage', 'test', (input) =>
      pending('decompose', input),
    );
    api.capabilities.register('encodeImage', 'test', (input) =>
      pending('encode', input),
    );
    api.capabilities.register('segmentImage', 'test', (input) =>
      pending('segment', input),
    );
    api.capabilities.register('removeByMask', 'test', (input) =>
      pending('remove', input),
    );
    await api.edit(
      (editor) => {
        editor.updateNode(editor.getNodeById('left')!, {
          fills: [
            { type: 'image', value: window.imageProbe.source, opacity: 1 },
          ],
          isEditing: true,
        });
        editor.setAppState({ contextBarVisible: true });
        editor.selectNodes([editor.getNodeById('left')!]);
      },
      { capture: 'NEVER' },
    );
  });
  const bar = page
    .getByTestId('left-shortcuts')
    .locator('ic-spectrum-context-image-edit-bar');
  await expect(bar).toBeVisible();
  return { bar, errors };
}

export async function count(page: Page, value: number) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.apis.left.getNodes().filter((node) => !node.isDeleted).length,
      ),
    )
    .toBe(value);
}
