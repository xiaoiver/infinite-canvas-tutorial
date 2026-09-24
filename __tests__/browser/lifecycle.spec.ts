import { test, expect, type Page } from '@playwright/test';
import type { BrowserHarness } from './fixtures/main';
import { installProbes } from './fixtures/probes';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
    lifecycleProbes: {
      listeners(): number;
      capturePageListeners(): void;
      pageListeners(): number;
      leaks(): unknown;
      resources(): { side: string; live: Record<string, number> }[];
    };
  }
}
let errors: string[];
async function open(page: Page) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(installProbes);
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready');
  await expect
    .poll(() =>
      page.evaluate(() =>
        ['left', 'right'].every(
          (side) =>
            window.canvasRegression.state(side as 'left' | 'right')?.gpu,
        ),
      ),
    )
    .toBe(true);
}
test.beforeEach(async ({ page }) => {
  errors = [];
  await open(page);
});
test.afterEach(async ({ context }) => {
  for (const page of context.pages()) {
    await page.evaluate(async () => {
      if (window.canvasRegression?.ready)
        await window.canvasRegression.shutdown();
    });
  }
  expect(errors).toEqual([]);
});

test('edits and undo/redo stay in the owning WebGL canvas', async ({
  page,
}) => {
  await expect
    .poll(() =>
      page.evaluate(() => window.canvasRegression.pixel('left', 80, 80)),
    )
    .toEqual([255, 0, 0, 255]);
  await page.getByRole('button', { name: 'Edit left canvas' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.canvasRegression.pixel('left', 80, 80)),
    )
    .toEqual([0, 0, 255, 255]);
  expect(
    await page.evaluate(() => window.canvasRegression.pixel('right', 80, 80)),
  ).toEqual([255, 0, 0, 255]);
  await page.getByRole('button', { name: 'Undo left', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.canvasRegression.state('left')!.nodes[0].width,
      ),
    )
    .toBe(120);
  await page.getByRole('button', { name: 'Redo left', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.canvasRegression.state('left')!.nodes[0].width,
      ),
    )
    .toBe(160);
  expect(
    await page.evaluate(
      () => window.canvasRegression.state('right')!.nodes[0].width,
    ),
  ).toBe(120);
});

test('destroy/recreate cancels tasks and releases GPU resources and global listeners', async ({
  page,
}) => {
  const { baseline, pageListeners } = await page.evaluate(() => ({
    baseline: window.lifecycleProbes.listeners(),
    pageListeners: window.lifecycleProbes.pageListeners(),
  }));
  const canvasListeners = baseline - pageListeners;
  expect(canvasListeners).toBeGreaterThan(0);
  for (let i = 0; i < 3; i++) {
    expect(
      await page.evaluate(() =>
        window.canvasRegression.queueThenDestroy('left'),
      ),
    ).toBe(false);
    await expect
      .poll(() => page.evaluate(() => window.lifecycleProbes.listeners()))
      .toBe(pageListeners + canvasListeners / 2);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.lifecycleProbes
            .resources()
            .filter((r) => r.side === 'left')
            .map((r) => r.live),
        ),
      )
      .toEqual(
        Array.from({ length: i + 1 }, () => ({
          Buffer: 0,
          Texture: 0,
          Program: 0,
          Shader: 0,
          Framebuffer: 0,
          Renderbuffer: 0,
          VertexArray: 0,
        })),
      );
    await page.evaluate(() => window.canvasRegression.recreate('left'));
    await expect
      .poll(() =>
        page.evaluate(() => window.canvasRegression.state('left')?.gpu),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => window.canvasRegression.pixel('left', 80, 80)),
      )
      .toEqual([255, 0, 0, 255]);
    expect(await page.evaluate(() => window.lifecycleProbes.listeners())).toBe(
      baseline,
    );
  }
  await page.evaluate(() => window.canvasRegression.edit('right'));
  await expect
    .poll(() =>
      page.evaluate(() => window.canvasRegression.pixel('right', 80, 80)),
    )
    .toEqual([0, 0, 255, 255]);
  await page.evaluate(() => window.canvasRegression.shutdown());
  await expect
    .poll(() => page.evaluate(() => window.lifecycleProbes.listeners()))
    .toBe(pageListeners);
  expect(await page.evaluate(() => window.lifecycleProbes.leaks())).toEqual([]);
});

test('the page baseline stays fixed and later global listeners remain tracked', async ({
  page,
}) => {
  const counts = await page.evaluate(() => {
    const probes = window.lifecycleProbes;
    const before = probes.listeners();
    const pageBefore = probes.pageListeners();
    const listener = () => {};
    // Use the same event type as the page-wide OverlayStack and canvas inputs.
    window.addEventListener('keydown', listener);
    const during = probes.listeners();
    const pageDuring = probes.pageListeners();
    window.removeEventListener('keydown', listener);
    return {
      before,
      pageBefore,
      during,
      pageDuring,
      after: probes.listeners(),
    };
  });
  expect(counts.during).toBe(counts.before + 1);
  expect(counts.pageDuring).toBe(counts.pageBefore);
  expect(counts.after).toBe(counts.before);
});

test('destroy terminates a real worker and rejects active and queued operations', async ({
  page,
}) => {
  expect(
    await page.evaluate(() => window.canvasRegression.workers.created),
  ).toBe(0);
  await page.evaluate(() => window.canvasRegression.startWorker('left'));
  await expect
    .poll(() => page.evaluate(() => window.canvasRegression.workers.started))
    .toEqual(['left:hold']);
  await page.evaluate(() => window.canvasRegression.destroy('left'));
  await expect
    .poll(() => page.evaluate(() => window.canvasRegression.workers.settled))
    .toEqual([
      'active:Worker client disposed',
      'queued:Worker client disposed',
    ]);
  expect(
    await page.evaluate(() => window.canvasRegression.workers.terminated),
  ).toBe(1);
  expect(await page.evaluate(() => window.canvasRegression.echo('right'))).toBe(
    'ok',
  );
  expect(
    await page.evaluate(() => window.canvasRegression.workers.started),
  ).toEqual(['left:hold', 'right:echo']);
});

for (const provider of ['yjs', 'loro'] as const) {
  test(`${provider}: edits, undo/redo, and deletion converge across browser pages`, async ({
    page,
    context,
  }, info) => {
    const other = await context.newPage();
    await open(other);
    const room = `regression-${provider}-${info.testId}`;
    await page.evaluate(
      ([kind, room]) =>
        window.canvasRegression.connect(kind as 'yjs' | 'loro', room),
      [provider, room],
    );
    await other.evaluate(
      ([kind, room]) =>
        window.canvasRegression.connect(kind as 'yjs' | 'loro', room),
      [provider, room],
    );
    for (const replica of [page, other])
      await expect
        .poll(() =>
          replica.evaluate(
            () => window.canvasRegression.state('left')!.nodes[0]?.id,
          ),
        )
        .toBe('0');
    await page.evaluate(() => window.canvasRegression.edit('left', '0', 160));
    await expect
      .poll(() =>
        other.evaluate(
          () => window.canvasRegression.state('left')!.nodes[0]?.width,
        ),
      )
      .toBe(160);
    await page.evaluate(() => window.canvasRegression.undo('left'));
    await expect
      .poll(() =>
        other.evaluate(
          () => window.canvasRegression.state('left')!.nodes[0]?.width,
        ),
      )
      .toBe(100);
    await page.evaluate(() => window.canvasRegression.redo('left'));
    await expect
      .poll(() =>
        other.evaluate(
          () => window.canvasRegression.state('left')!.nodes[0]?.width,
        ),
      )
      .toBe(160);
    await other.evaluate(() => window.canvasRegression.remove('left', '0'));
    await expect
      .poll(() =>
        page.evaluate(
          () => window.canvasRegression.state('left')!.nodes.length,
        ),
      )
      .toBe(0);
    // A late-joining tab must not resurrect the immutable seed.
    const late = await context.newPage();
    await open(late);
    await late.evaluate(
      ([kind, room]) =>
        window.canvasRegression.connect(kind as 'yjs' | 'loro', room),
      [provider, room],
    );
    await expect
      .poll(() =>
        late.evaluate(
          () => window.canvasRegression.state('left')!.nodes.length,
        ),
      )
      .toBe(0);
  });
}
