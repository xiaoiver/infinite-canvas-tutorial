import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import type { LottieCase } from './fixtures/lottie';

test.beforeEach(async ({ page }) => {
  await page.goto('/lottie.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});

function compare(urls: string[], label: string) {
  const [actual, reference] = urls.map((url) =>
    PNG.sync.read(Buffer.from(url.split(',')[1], 'base64')),
  );
  let difference = 0,
    expectedInk = 0,
    actualInk = 0,
    maxColorError = 0,
    maxAlphaError = 0;
  const covered = (png: PNG, x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < png.width &&
    y < png.height &&
    png.data[(y * png.width + x) * 4 + 3] > 127;
  const neighbors = (png: PNG, x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (covered(png, x + dx, y + dy)) return true;
    return false;
  };
  for (let y = 0; y < actual.height; y++)
    for (let x = 0; x < actual.width; x++) {
      const a = covered(actual, x, y),
        b = covered(reference, x, y);
      // The SDF and Canvas renderers differ by one pixel at antialiased edges.
      // Compare both silhouettes with a local one-pixel tolerance, not a global percentage.
      if ((a && !neighbors(reference, x, y)) || (b && !neighbors(actual, x, y)))
        difference++;
      if (a) actualInk++;
      if (b) expectedInk++;
      if (a && b) {
        const i = (y * actual.width + x) * 4;
        const interior = [actual, reference].every((png) =>
          [-1, 0, 1].every((dy) =>
            [-1, 0, 1].every((dx) => covered(png, x + dx, y + dy)),
          ),
        );
        if (interior) {
          maxAlphaError = Math.max(
            maxAlphaError,
            Math.abs(actual.data[i + 3] - reference.data[i + 3]),
          );
          if (actual.data[i + 3] > 250 && reference.data[i + 3] > 250)
            for (let c = 0; c < 3; c++)
              maxColorError = Math.max(
                maxColorError,
                Math.abs(actual.data[i + c] - reference.data[i + c]),
              );
        }
      }
    }
  expect(
    difference,
    `${label}: coverage outside tolerance (${actualInk}/${expectedInk} ink)`,
  ).toBe(0);
  expect(maxColorError, `${label}: interior color`).toBeLessThanOrEqual(3);
  expect(maxAlphaError, `${label}: interior alpha`).toBeLessThanOrEqual(3);
  if (expectedInk === 0) expect(actualInk, label).toBe(0);
  else expect(actualInk, label).toBeGreaterThan(0);
}

test('fixed frames match lottie-web for position and animated trim returning to full coverage', async ({
  page,
}) => {
  for (const options of [
    { kind: 'move' },
    { kind: 'trim', animated: true },
  ] satisfies LottieCase[]) {
    await page.evaluate(
      (options: LottieCase) => window.lottieTest.load(options),
      options,
    );
    for (const frame of [0, 15, 30, 60])
      compare(
        await page.evaluate((frame) => window.lottieTest.seek(frame), frame),
        `${options.kind} frame ${frame}`,
      );
  }
});

test('trim endpoints, full offsets, wrapping and empty round caps match lottie-web', async ({
  page,
}) => {
  for (const options of [
    { start: 0, end: 100, offset: 45 },
    { start: 0, end: 100, dashed: true },
    { start: 80, end: 20 },
    { start: 20, end: 80, offset: 180 },
    { start: 20, end: 80, offset: -90 },
    { start: 30, end: 30, round: true },
  ]) {
    await page.evaluate(
      (options: Omit<LottieCase, 'kind'>) =>
        window.lottieTest.load({ kind: 'trim', ...options }),
      options,
    );
    compare(
      await page.evaluate(() => window.lottieTest.seek(0)),
      JSON.stringify(options),
    );
  }
});

test('autoplay false, seek, stop, render idempotence and destroy own their resources', async ({
  page,
}) => {
  await page.evaluate(() => window.lottieTest.load({ kind: 'move' }));
  const result = await page.evaluate(async () => {
    const { api, animation, rendered } = window.lottieTest;
    const player = animation(),
      owner = api();
    const initialCount = owner.getNodes().length;
    const controllers = player.getAnimations();
    await rendered();
    const initialTime = player.getCurrentTime();
    await owner.edit(() => {
      player.render(owner);
      owner.updateNodes([
        {
          id: 'unrelated',
          type: 'rect',
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          zIndex: 100,
        },
      ]);
    });
    const repeated =
      player.getAnimations().length === controllers.length &&
      owner.getNodes().length === initialCount + 1;
    player.goTo(30, true);
    const seek = player.getCurrentTime(true);
    player.play();
    await rendered();
    player.stop();
    const stopped = [player.getPlayState(), player.getCurrentTime(true)];
    await player.destroy();
    await player.destroy();
    await rendered();
    let rejected = false;
    try {
      player.render(owner);
    } catch {
      rejected = true;
    }
    return {
      initialTime,
      repeated,
      seek,
      stopped,
      rejected,
      states: controllers.map((c) => c.getPlayState()),
      nodes: owner.getNodes().map((n) => n.id),
    };
  });
  expect(result).toMatchObject({
    initialTime: 0,
    repeated: true,
    seek: 30,
    stopped: ['paused', 0],
    rejected: true,
    nodes: ['unrelated'],
  });
  expect(result.states.length).toBeGreaterThan(0);
  expect(result.states.every((s) => s === 'cancelled')).toBe(true);
});

test('canvas teardown cancels a running player and queued cleanup', async ({
  page,
}) => {
  await page.evaluate(() => window.lottieTest.load({ kind: 'move' }));
  const result = await page.evaluate(async () => {
    const player = window.lottieTest.animation();
    const controllers = player.getAnimations();
    player.play();
    await window.lottieTest.api().edit((api) => api.destroy());
    await player.destroy();
    await window.lottieTest.rendered();
    return controllers.map((controller) => controller.getPlayState());
  });
  expect(result.length).toBeGreaterThan(0);
  expect(result.every((state) => state === 'cancelled')).toBe(true);
});
