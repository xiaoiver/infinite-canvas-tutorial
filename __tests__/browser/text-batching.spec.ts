import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { writeFileSync } from 'node:fs';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/glyph-atlas';

for (const backend of ['core', 'ecs']) {
  test(`${backend} ordered text batches preserve full pixels, edits, barriers, exports and ownership`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(installProbes);
    await page.goto(`/glyph-atlas.html?backend=${backend}`);
    await expect(page.locator('output')).toHaveText('Ready');
    await page.evaluate(() =>
      window.mixedRenderer.configure(100, 'grouped', false),
    );
    await page.evaluate(() => window.mixedRenderer.editText());
    const image = async () =>
      PNG.sync.read(await page.locator('canvas').screenshot({ scale: 'css' }));
    const equal = (a: PNG, b: PNG) => {
      expect([a.width, a.height]).toEqual([b.width, b.height]);
      // Baking changes floating point evaluation order. Allow fewer than
      // 0.011% edge pixels in a 960x640 frame, including long overlapping labels.
      const diff = new PNG({ width: a.width, height: a.height });
      const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
        threshold: 0.1,
      });
      if (pixels >= 64) {
        writeFileSync(testInfo.outputPath('full.png'), PNG.sync.write(a));
        writeFileSync(testInfo.outputPath('batch.png'), PNG.sync.write(b));
        writeFileSync(
          testInfo.outputPath('difference.png'),
          PNG.sync.write(diff),
        );
      }
      expect(pixels).toBeLessThan(64);
    };
    async function compare() {
      await page.evaluate(() => window.mixedRenderer.textBatching(false));
      const full = await image();
      const picks = await page.evaluate(() =>
        window.mixedRenderer.textPicking(),
      );
      const independent = await page.evaluate(() =>
        window.mixedRenderer.measure('pan', 2, 1),
      );
      await page.evaluate(() => window.mixedRenderer.textBatching(true));
      const batched = await page.evaluate(() =>
        window.mixedRenderer.measure('pan', 2, 1),
      );
      equal(full, await image());
      expect(
        await page.evaluate(() => window.mixedRenderer.textPicking()),
      ).toEqual(picks);
      expect(batched.webglError).toBe(0);
      expect(batched.native.indices).toBe(independent.native.indices);
      return { independent, batched };
    }
    const first = await compare();
    expect(
      first.independent.native.drawcalls - first.batched.native.drawcalls,
    ).toBeGreaterThanOrEqual(19);
    // Movement/paint updates rebuild affected pages; painter depth survives overlap.
    await page.evaluate(() => window.mixedRenderer.textScenario('overlap'));
    await compare();
    await page.evaluate(() => window.mixedRenderer.textScenario('transform'));
    await compare();
    for (const text of [
      'Changed',
      'AA\nBBBB',
      'Ω中文',
      'A'.repeat(256),
      'N0',
    ]) {
      await page.evaluate((t) => window.mixedRenderer.editText(t), text);
      await compare();
    }
    for (const mode of ['hidden', 'culled', 'visible'] as const) {
      await page.evaluate((m) => window.mixedRenderer.textPresence(m), mode);
      await compare();
    }
    const full = await page.evaluate(async () => {
      await window.mixedRenderer.textBatching(false);
      return window.mixedRenderer.raster();
    });
    const batched = await page.evaluate(async () => {
      await window.mixedRenderer.textBatching(true);
      return window.mixedRenderer.raster();
    });
    equal(
      PNG.sync.read(Buffer.from(full.split(',')[1], 'base64')),
      PNG.sync.read(Buffer.from(batched.split(',')[1], 'base64')),
    );
    const live: number[] = [];
    for (let i = 0; i < 6; i++) {
      await page.evaluate(
        (t) => window.mixedRenderer.editOneText(0, t),
        ['AB', 'XYZ', 'N0'][i % 3],
      );
      const state = await page.evaluate(() => window.mixedRenderer.state());
      if (i >= 3)
        live.push(state.resources.reduce((n, c) => n + c.live.Texture, 0));
    }
    expect(Math.max(...live) - Math.min(...live)).toBeLessThanOrEqual(2);
    await page.evaluate(() => window.mixedRenderer.removeTexts(1));
    await compare();
    const cleared = await page.evaluate(() =>
      window.mixedRenderer.removeTexts(1000),
    );
    expect(cleared.visible).toBe(80);
    const baseline = await page.evaluate(() => window.mixedRenderer.destroy());
    const resources = await page.evaluate(() =>
      window.lifecycleProbes.resources(),
    );
    if (backend === 'core') expect(resources).toEqual(baseline);
    else
      expect(
        resources.every((c) => Object.values(c.live).every((n) => n === 0)),
      ).toBe(true);
    expect(errors).toEqual([]);
  });
  test(`${backend} text does not batch across interleaved painter barriers`, async ({
    page,
  }) => {
    await page.addInitScript(installProbes);
    await page.goto(`/glyph-atlas.html?backend=${backend}`);
    await expect(page.locator('output')).toHaveText('Ready');
    await page.evaluate(() =>
      window.mixedRenderer.configure(100, 'interleaved', false),
    );
    const a = await page.evaluate(() =>
      window.mixedRenderer.measure('pan', 2, 1),
    );
    await page.evaluate(() => window.mixedRenderer.textBatching(true));
    const b = await page.evaluate(() =>
      window.mixedRenderer.measure('pan', 2, 1),
    );
    // Core switches from global legacy batching to ordered solid pages too.
    expect(b.native.drawcalls).toBeGreaterThanOrEqual(a.native.drawcalls);
    expect(a.native.indices).toBe(b.native.indices);
    await page.evaluate(() => window.mixedRenderer.destroy());
  });
}

for (const backend of ['core', 'ecs']) {
  test(`${backend} arbitrary paint edits retain glyph geometry and atlas after a split`, async ({
    page,
  }) => {
    await page.addInitScript(installProbes);
    await page.goto(`/glyph-atlas.html?backend=${backend}`);
    await expect(page.locator('output')).toHaveText('Ready');
    await page.evaluate(() => window.mixedRenderer.textBatching(true));
    await page.evaluate(() =>
      window.mixedRenderer.configure(100, 'grouped', false),
    );
    await page.evaluate(() => window.mixedRenderer.editText());
    await page.evaluate(() => window.mixedRenderer.paintText(5, 'red'));
    const before = await page.evaluate(() => window.glyphAtlasProbe());
    const resources: number[] = [];
    for (const color of [
      '#1e293b',
      '#334155',
      '#fb923c',
      '#4ade80',
      '#38bdf8',
    ]) {
      const state = await page.evaluate(
        (c) => window.mixedRenderer.paintText(5, c, 0.7),
        color,
      );
      expect(state.webglError).toBe(0);
      resources.push(
        state.resources.reduce((n, c) => n + c.live.Buffer + c.live.Texture, 0),
      );
    }
    const after = await page.evaluate(() => window.glyphAtlasProbe());
    expect(after.textGeometryBuilds).toBe(before.textGeometryBuilds);
    expect(after.atlasUploads).toBe(before.atlasUploads);
    expect(after.glyphDraws).toBe(before.glyphDraws);
    expect(new Set(resources).size).toBe(1);
    await page.evaluate(() =>
      window.mixedRenderer.editOneText(5, 'Alpha typography '.repeat(3)),
    );
    await page.evaluate(() =>
      window.mixedRenderer.paintText(5, '#ff000080', 0.7),
    );
    const batch = PNG.sync.read(
      await page.locator('canvas').screenshot({ scale: 'css' }),
    );
    await page.evaluate(() => window.mixedRenderer.textBatching(false));
    const full = PNG.sync.read(
      await page.locator('canvas').screenshot({ scale: 'css' }),
    );
    expect(
      pixelmatch(batch.data, full.data, null, batch.width, batch.height, {
        threshold: 0.1,
      }),
    ).toBeLessThan(64);
    const baseline = await page.evaluate(() => window.mixedRenderer.destroy());
    const end = await page.evaluate(() => window.lifecycleProbes.resources());
    if (backend === 'core') expect(end).toEqual(baseline);
    else
      expect(
        end.every((c) => Object.values(c.live).every((n) => n === 0)),
      ).toBe(true);
  });
}

for (const backend of ['core', 'ecs']) {
  test(`${backend} resolves one text key per label per edit frame`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.addInitScript(installProbes);
    await page.goto(`/glyph-atlas.html?backend=${backend}`);
    await expect(page.locator('output')).toHaveText('Ready');
    await page.evaluate(() => window.mixedRenderer.textBatching(true));
    await page.evaluate(() =>
      window.mixedRenderer.configure(1000, 'grouped', false),
    );
    const before = await page.evaluate(() => window.glyphAtlasProbe());
    const orderBefore = await page.evaluate(() => window.mixedRenderer.state());
    await page.evaluate(() => window.mixedRenderer.measure('pan', 2, 1));
    const camera = await page.evaluate(() => window.glyphAtlasProbe());
    expect(camera.textBatchKeyChecks).toBe(before.textBatchKeyChecks);
    const frames = await page.evaluate(() =>
      window.mixedRenderer.measure('edit', 2, 1),
    );
    const after = await page.evaluate(() => window.glyphAtlasProbe());
    expect(frames.visible).toBe(1000);
    expect(frames.native.drawcalls).toBe(407);
    expect(frames.native.bufferBytes).toBe(backend === 'core' ? 1456 : 8008);
    expect(frames.webglError).toBe(0);
    expect(after.textBatchKeyChecks - camera.textBatchKeyChecks).toBe(600);
    expect(after.textLayoutChecks - camera.textLayoutChecks).toBe(204);
    // Painting retains ranks even when ECS receives full serialized nodes.
    expect(frames.orderSignals).toBe(orderBefore.orderSignals);
    if (backend === 'ecs')
      expect(frames.sortInputs).toBeGreaterThan(orderBefore.sortInputs);
    await page.evaluate(() => window.mixedRenderer.destroy());
  });
}

for (const backend of ['core', 'ecs']) {
  test(`${backend} real painter reorder changes depth and retains full-path pixels`, async ({
    page,
  }) => {
    await page.addInitScript(installProbes);
    await page.goto(`/glyph-atlas.html?backend=${backend}`);
    await expect(page.locator('output')).toHaveText('Ready');
    await page.evaluate(() => window.mixedRenderer.textBatching(true));
    await page.evaluate(() =>
      window.mixedRenderer.configure(100, 'grouped', false),
    );
    await page.evaluate(() => window.mixedRenderer.editText());
    await page.evaluate(() => window.mixedRenderer.textScenario('overlap'));
    await page.evaluate(() => window.mixedRenderer.paintText(0, 'red', 0.6));
    const image = async () =>
      PNG.sync.read(await page.locator('canvas').screenshot({ scale: 'css' }));
    const before = await image();
    const order = await page.evaluate(() => window.mixedRenderer.textOrder());
    const state = await page.evaluate(() => window.mixedRenderer.state());
    const moved = await page.evaluate(() => window.mixedRenderer.reorderText());
    expect(moved.orderSignals).toBeGreaterThan(state.orderSignals);
    const next = await page.evaluate(() => window.mixedRenderer.textOrder());
    expect(next.at(-1)).toBe(order[0]);
    expect(next).not.toEqual(order);
    const batched = await image();
    expect(
      pixelmatch(before.data, batched.data, null, before.width, before.height, {
        threshold: 0.1,
      }),
    ).toBeGreaterThan(0);
    await page.evaluate(() => window.mixedRenderer.textBatching(false));
    const full = await image();
    expect(
      pixelmatch(batched.data, full.data, null, full.width, full.height, {
        threshold: 0.1,
      }),
    ).toBeLessThan(64);
    await page.evaluate(() => window.mixedRenderer.destroy());
  });
}
