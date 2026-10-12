import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/animation-export';

for (const recover of [false, true]) {
  test(`plays every exported GIF color${
    recover ? ' after a failed export' : ''
  }`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/animation-export.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    const result = await page.evaluate(
      (recover) => window.animationExportTest.gif(recover),
      recover,
    );
    expect(result.failure).toBe(
      recover ? 'injected render failure' : undefined,
    );
    expect(result.type).toBe('image/gif');
    expect(result.bytes).toBeGreaterThan(50);
    expect(result.size).toEqual([64, 32]);
    // drawImage(animatedImage) reads the first frame. Sample the compositor to
    // verify actual animation in both Chromium and WebKit, without a mock decoder.
    const seen = new Set<number>();
    await expect(async () => {
      const png = PNG.sync.read(await page.locator('#gif').screenshot());
      const center =
        (Math.floor(png.height / 2) * png.width + Math.floor(png.width / 2)) *
        4;
      const rgb = [...png.data.subarray(center, center + 3)];
      expect(Math.max(...rgb)).toBeGreaterThan(180);
      expect(Math.min(...rgb)).toBeLessThan(70);
      seen.add(rgb.indexOf(Math.max(...rgb)));
      expect([...seen].sort()).toEqual([0, 1, 2]);
    }).toPass({ timeout: 10000, intervals: [70, 110, 150] });
    await page.evaluate(() => window.animationExportTest.dispose());
    expect(errors).toEqual([]);
  });

  test(`plays WebM and releases capture resources${
    recover ? ' after a failed export' : ''
  }`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/animation-export.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    const mime = await page.evaluate(() => window.animationExportTest.mime());
    if (!mime) {
      expect(
        await page.evaluate(() => window.animationExportTest.unsupported()),
      ).toContain('not supported');
      test.info().annotations.push({
        type: 'capability',
        description:
          'This browser has no WebM encoder; unsupported rejection verified.',
      });
      expect(errors).toEqual([]);
      return;
    }
    const { result, captures, sourceSize } = await page.evaluate(
      (recover) => window.animationExportTest.webm(recover),
      recover,
    );
    expect(result.failure).toBe(
      recover ? 'injected render failure' : undefined,
    );
    expect(result.type).toBe('video/webm');
    expect(result.bytes).toBeGreaterThan(100);
    expect(result.playback).toEqual({ size: [64, 32], colors: [0, 1, 2] });
    expect(captures).toHaveLength(recover ? 2 : 1);
    for (const capture of captures) {
      expect(capture.size).toEqual([0, 0]);
      expect(capture.tracks.length).toBeGreaterThan(0);
      expect(capture.tracks.every((state) => state === 'ended')).toBe(true);
    }
    expect(sourceSize).toEqual([64, 32]);
    await page.evaluate(() => window.animationExportTest.dispose());
    expect(errors).toEqual([]);
  });
}
