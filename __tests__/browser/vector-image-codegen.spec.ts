import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import type {} from './fixtures/design-to-code-docs';

test('vector image fills render natural sizing and intermediate positions', async ({
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
    none: window.designToCodeDocs.paintMarkup('vector-none'),
    scaleDown: window.designToCodeDocs.paintMarkup('vector-scale-down'),
    contain: window.designToCodeDocs.paintMarkup('vector-contain'),
    opacity: window.designToCodeDocs.paintMarkup('vector-opacity'),
    blend: window.designToCodeDocs.paintMarkup('vector-blend'),
    clip: window.designToCodeDocs.paintMarkup('vector-clip'),
    hole: window.designToCodeDocs.paintMarkup('vector-hole'),
    offset: window.designToCodeDocs.paintMarkup('vector-offset'),
  }));
  const sample = async (html: string, x: number, y: number) => {
    await page.setContent(html);
    await page.addStyleTag({ content: 'body { margin: 0; }' });
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images, (image) => image.decode().catch(() => {})),
      ),
    );
    const png = PNG.sync.read(await page.screenshot({ scale: 'css' }));
    const offset = (y * png.width + x) * 4;
    return [...png.data.slice(offset, offset + 3)];
  };
  for (const html of [markup.none, markup.scaleDown]) {
    expect(await sample(html, 12, 43)).toEqual([0, 255, 0]);
    expect(await sample(html, 5, 5)).toEqual([255, 0, 0]);
    expect(await sample(html, 30, 30)).toEqual([255, 0, 0]);
  }
  expect(await sample(markup.contain, 10, 30)).toEqual([0, 255, 0]);
  expect(await sample(markup.contain, 50, 30)).toEqual([255, 0, 0]);
  const opacity = await sample(markup.opacity, 12, 43);
  expect(opacity[0]).toBeGreaterThan(100);
  expect(opacity[1]).toBeGreaterThan(100);
  expect(opacity[2]).toBe(0);
  expect(await sample(markup.blend, 12, 43)).toEqual([0, 0, 0]);
  expect(await sample(markup.clip, 12, 43)).toEqual([0, 255, 0]);
  expect(await sample(markup.clip, 18, 43)).toEqual([255, 255, 255]);
  expect(await sample(markup.hole, 10, 30)).toEqual([0, 255, 0]);
  expect(await sample(markup.hole, 30, 30)).toEqual([255, 255, 255]);
  expect(await sample(markup.offset, 12, 12)).toEqual([0, 255, 0]);
  expect(await sample(markup.offset, 5, 5)).toEqual([255, 0, 0]);
  expect(await sample(markup.offset, 45, 45)).toEqual([255, 255, 255]);
});

test('vector image strokes keep geometry, arrows and stroke alignment', async ({
  page,
}) => {
  await page.goto('/design-to-code-docs.html');
  await expect
    .poll(
      () =>
        page.evaluate(() => typeof window.designToCodeDocs?.vectorStrokeMarkup),
      { timeout: 30000 },
    )
    .toBe('function');
  const markup = await page.evaluate(() => ({
    center: window.designToCodeDocs.vectorStrokeMarkup('center'),
    arrow: window.designToCodeDocs.vectorStrokeMarkup('arrow'),
    inner: window.designToCodeDocs.vectorStrokeMarkup('inner'),
    outer: window.designToCodeDocs.vectorStrokeMarkup('outer'),
  }));
  const sample = async (html: string, x: number, y: number) => {
    await page.setContent(html);
    await page.addStyleTag({ content: 'body { margin: 0; }' });
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images, (image) => image.decode().catch(() => {})),
      ),
    );
    const png = PNG.sync.read(await page.screenshot({ scale: 'css' }));
    const offset = (y * png.width + x) * 4;
    return [...png.data.slice(offset, offset + 3)];
  };
  expect(await sample(markup.center, 20, 2)).toEqual([0, 255, 0]);
  expect(await sample(markup.center, 38, 2)).toEqual([0, 0, 255]);
  expect(await sample(markup.center, 20, 20)).toEqual([255, 255, 255]);
  expect(await sample(markup.arrow, 25, 10)).toEqual([0, 255, 0]);
  expect(await sample(markup.inner, 2, 20)).toEqual([0, 255, 0]);
  expect(await sample(markup.inner, 43, 20)).toEqual([255, 255, 255]);
  expect(await sample(markup.outer, 43, 20)).toEqual([0, 255, 0]);
  expect(await sample(markup.outer, 2, 20)).toEqual([255, 255, 255]);
});

test('layered vector image strokes preserve paint order and blending', async ({
  page,
}) => {
  await page.goto('/design-to-code-docs.html');
  await expect
    .poll(
      () =>
        page.evaluate(
          () => typeof window.designToCodeDocs?.vectorLayeredStrokeMarkup,
        ),
      { timeout: 30000 },
    )
    .toBe('function');
  const markup = await page.evaluate(() => ({
    top: window.designToCodeDocs.vectorLayeredStrokeMarkup('image-top'),
    bottom: window.designToCodeDocs.vectorLayeredStrokeMarkup('image-bottom'),
    blend: window.designToCodeDocs.vectorLayeredStrokeMarkup('blended'),
    shadow: window.designToCodeDocs.vectorLayeredStrokeMarkup('shadow'),
  }));
  const sample = async (html: string, y = 2) => {
    await page.setContent(html);
    await page.addStyleTag({ content: 'body { margin: 0; }' });
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images, (image) => image.decode().catch(() => {})),
      ),
    );
    const png = PNG.sync.read(await page.screenshot({ scale: 'css' }));
    const offset = (y * png.width + 20) * 4;
    return [...png.data.slice(offset, offset + 3)];
  };
  expect(await sample(markup.top)).toEqual([0, 255, 0]);
  expect(await sample(markup.bottom)).toEqual([255, 0, 0]);
  expect(await sample(markup.blend)).toEqual([0, 0, 0]);
  expect(await sample(markup.shadow, 14)).toEqual([0, 0, 0]);
});
