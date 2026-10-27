import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type {} from './fixtures/design-to-code-docs';

test('downloaded React project includes temporary canvas images once', async ({
  page,
}) => {
  await page.goto('/design-to-code-docs.html');
  await expect
    .poll(() => page.evaluate(() => window.designToCodeDocs.scene()), {
      timeout: 30000,
    })
    .toBe('dashboard');
  const { url, svg } = await page.evaluate(() =>
    window.designToCodeDocs.setDashboardBlobImage(),
  );
  await page.getByRole('button', { name: 'React + Tailwind' }).click();
  await expect(page.locator('.interface-demo-code pre code')).toContainText(
    url,
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '下载 React 工程' }).click(),
  ]);
  const { unzipSync, strFromU8 } = await import(
    '../../packages/site/node_modules/fflate/esm/index.mjs'
  );
  const project = unzipSync(
    new Uint8Array(await readFile((await download.path())!)),
  );
  const appSource = strFromU8(project['src/App.tsx']);
  expect(appSource).not.toContain(url);
  expect(appSource.split('/assets/canvas-image-1.svg')).toHaveLength(3);
  expect(strFromU8(project['public/assets/canvas-image-1.svg'])).toBe(svg);
  expect(
    Object.keys(project).filter((path) => path.startsWith('public/assets/')),
  ).toEqual(['public/assets/canvas-image-1.svg']);
});
