import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/core-text-lifetime';

type Snapshot = Awaited<ReturnType<typeof window.coreTextLifetime.state>>;
const owned = (state: Snapshot) =>
  state.resources.map(({ side, live }) => ({
    side,
    Buffer: live.Buffer,
    Texture: live.Texture,
  }));
let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(installProbes);
  await page.goto('/core-text-lifetime.html');
  await expect(page.locator('output')).toHaveText('Ready');
});
test.afterEach(async ({ page }) => {
  const baseline = await page.evaluate(() => window.coreTextLifetime.destroy());
  expect(await page.evaluate(() => window.lifecycleProbes.resources())).toEqual(
    baseline,
  );
  expect(errors).toEqual([]);
});

for (const ordered of [false, true]) {
  test(`whole-document text replacement releases glyph and underline resources (ordered=${ordered})`, async ({
    page,
  }) => {
    await page.evaluate(
      (value) => window.coreTextLifetime.ordered(value),
      ordered,
    );
    const empty = await page.evaluate(() => window.coreTextLifetime.state());
    const active = await page.evaluate(() =>
      window.coreTextLifetime.replace(6),
    );
    expect(active.visible).toBe(6);
    expect(active.error).toBe(0);
    const image = await page.locator('canvas').screenshot();
    for (let i = 0; i < 4; i++) {
      const next = await page.evaluate(() =>
        window.coreTextLifetime.replace(6),
      );
      expect(next.visible).toBe(6);
      expect(next.error).toBe(0);
      expect(next.resources).toEqual(active.resources);
      expect((await page.locator('canvas').screenshot()).equals(image)).toBe(
        true,
      );
    }
    const cleared = await page.evaluate(() => window.coreTextLifetime.clear());
    expect(cleared.visible).toBe(0);
    expect(owned(cleared)).toEqual(owned(empty));
    expect(cleared.error).toBe(0);
  });

  test(`text survives visibility, culling and graph reentry with pixels, picking and export (ordered=${ordered})`, async ({
    page,
  }) => {
    await page.evaluate(
      (value) => window.coreTextLifetime.ordered(value),
      ordered,
    );
    const empty = await page.evaluate(() => window.coreTextLifetime.state());
    const initial = await page.evaluate(() =>
      window.coreTextLifetime.replace(1),
    );
    expect(await page.evaluate(() => window.coreTextLifetime.pick())).toBe(
      true,
    );
    const image = await page.locator('canvas').screenshot();
    const exported = await page.evaluate(() =>
      window.coreTextLifetime.export(),
    );
    const hidden = await page.evaluate(() =>
      window.coreTextLifetime.visible(false),
    );
    expect(hidden.visible).toBe(0);
    await page.evaluate(() => window.coreTextLifetime.visible(true));
    for (let i = 0; i < 3; i++) {
      const outside = await page.evaluate(() =>
        window.coreTextLifetime.camera(10000),
      );
      expect(outside.visible).toBe(0);
      expect(owned(outside)).toEqual(owned(empty));
      const restored = await page.evaluate(() =>
        window.coreTextLifetime.camera(0),
      );
      expect(restored.visible).toBe(1);
      expect(restored.document).toEqual(initial.document);
      expect(restored.resources).toEqual(initial.resources);
      expect(restored.error).toBe(0);
      expect((await page.locator('canvas').screenshot()).equals(image)).toBe(
        true,
      );
      expect(await page.evaluate(() => window.coreTextLifetime.pick())).toBe(
        true,
      );
      const removed = await page.evaluate(() =>
        window.coreTextLifetime.detach(),
      );
      expect(removed.visible).toBe(0);
      expect(owned(removed)).toEqual(owned(empty));
      const attached = await page.evaluate(() =>
        window.coreTextLifetime.attach(),
      );
      expect(attached.visible).toBe(1);
      expect(attached.document).toEqual(initial.document);
      expect(attached.resources).toEqual(initial.resources);
    }
    expect(await page.evaluate(() => window.coreTextLifetime.export())).toBe(
      exported,
    );
  });
}
