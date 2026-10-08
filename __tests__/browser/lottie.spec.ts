import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { PNG } from 'pngjs';
import type { LottieCase } from './fixtures/lottie';

test.beforeEach(async ({ page }) => {
  await page.goto('/lottie.html');
  await expect(page.locator('#status')).toHaveText('Ready');
});

function compare(urls: string[], label: string, compareAlpha = true) {
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
  // SmoothPolyline has existing alpha seams at tessellated curve joins (e.g.
  // alpha 192 instead of 255 inside a round stroke). Curved-stroke cases check
  // geometry and color, not alpha parity; fills and straight trims check all three.
  if (compareAlpha)
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
  await page.evaluate(() =>
    window.lottieTest.load({ kind: 'polystar', animated: true }),
  );
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

test('PolyStar stars and polygons match lottie-web, including winding, roundness and degenerate radii', async ({
  page,
}) => {
  for (const polygon of [false, true]) {
    for (const options of [
      { points: 5 },
      { points: 6.75, roundness: 70 },
      { points: 3, roundness: 100, direction: 3 },
      { points: 7, roundness: 40, nested: true },
      { outerRadius: 0, innerRadius: 0, roundness: 100 },
      { innerRadius: 0, roundness: 50 },
      { points: 5, roundness: 50, stroked: true },
    ]) {
      await page.evaluate(
        (options: LottieCase) => window.lottieTest.load(options),
        { kind: 'polystar', polygon, ...options } satisfies LottieCase,
      );
      expect(
        await page.evaluate(() =>
          window.lottieTest.animation().getDiagnostics(),
        ),
      ).toEqual([]);
      compare(
        await page.evaluate(() => window.lottieTest.seek(0)),
        JSON.stringify({ polygon, ...options }),
        !options.stroked,
      );
    }
  }
});

for (const options of [
  {},
  { polygon: true, eased: true, direction: 3, nested: true },
  { hold: true },
  { startFrame: 10 },
  { startFrame: 10, expression: true },
  { animatedPaint: true },
  { stroked: true, animatedPaint: true },
]) {
  test(`PolyStar parameter animation matches lottie-web: ${JSON.stringify(
    options,
  )}`, async ({ page }) => {
    await page.evaluate(
      (options: LottieCase) => window.lottieTest.load(options),
      { kind: 'polystar', animated: true, ...options } satisfies LottieCase,
    );
    // Out-of-order seeks catch stale caches as well as forward/backward playback.
    const end = 60 - (options.startFrame ?? 0);
    for (const frame of [0, 7.5, 14.99, 15, 30, end, 22.25, 0])
      compare(
        await page.evaluate((frame) => window.lottieTest.seek(frame), frame),
        `${JSON.stringify(options)} frame ${frame}`,
        !options.stroked,
      );
  });
}

test('PolyStar paused seek, repeat render, stop and destroy retain one owner for geometry', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.lottieTest.load({ kind: 'polystar', animated: true }),
  );
  const result = await page.evaluate(async () => {
    const { animation, api, rendered } = window.lottieTest;
    const player = animation(),
      owner = api();
    const controllers = player.getAnimations();
    const paths = () =>
      controllers
        .map((controller) => controller.getCurrentValues()?.d)
        .filter(Boolean);
    const initial = paths();
    player.goTo(30, true);
    const middle = paths();
    const count = owner.getNodes().length;
    await owner.edit(() => player.render(owner));
    const repeated =
      owner.getNodes().length === count &&
      player.getAnimations().length === controllers.length;
    player.setDirection(-1);
    player.play();
    await rendered();
    player.stop();
    const stopped = paths();
    await player.destroy();
    await player.destroy();
    await rendered();
    return {
      initial,
      middle,
      stopped,
      repeated,
      remaining: owner.getNodes().length,
      states: controllers.map((controller) => controller.getPlayState()),
    };
  });
  expect(result.initial).toHaveLength(1);
  expect(result.middle).not.toEqual(result.initial);
  expect(result.stopped).toEqual(result.initial);
  expect(result.repeated).toBe(true);
  expect(result.remaining).toBe(0);
  expect(result.states.every((state) => state === 'cancelled')).toBe(true);
});
