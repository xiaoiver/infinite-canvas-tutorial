import { expect, test } from '@playwright/test';
import type { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';

test.use({ viewport: { width: 1100, height: 850 }, deviceScaleFactor: 2 });

test('coordinate helpers follow camera rotation, CSS scale, scroll, and removal at DPR 2', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('left-status')).toHaveText('ready', {
    timeout: 45000,
  });
  await expect(page.getByTestId('right-status')).toHaveText('ready');
  const camera = { x: 70, y: -40, zoom: 2, rotation: Math.PI / 6 };
  await page.evaluate((camera) => {
    document.body.style.minHeight = '2200px';
    const scope = document.querySelector<HTMLElement>(
      '[data-testid="left-shortcuts"]',
    )!;
    Object.assign(scope.style, {
      marginLeft: '120px',
      marginTop: '250px',
      transform: 'scale(1.5, 0.75)',
      transformOrigin: 'top left',
    });
    window.apis.left.gotoLandmark(camera, { duration: 0 });
  }, camera);
  await expect
    .poll(() =>
      page.evaluate(() => window.apis.left.getAppState().cameraRotation),
    )
    .toBeCloseTo(camera.rotation, 5);
  const retained = await page.evaluateHandle(() => window.coordinates.left);
  const world = { x: 110, y: 90 };
  const expectedViewport = {
    x:
      camera.zoom *
      (Math.cos(camera.rotation) * (world.x - camera.x) +
        Math.sin(camera.rotation) * (world.y - camera.y)),
    y:
      camera.zoom *
      (-Math.sin(camera.rotation) * (world.x - camera.x) +
        Math.cos(camera.rotation) * (world.y - camera.y)),
  };
  for (const scrollY of [0, 140]) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    const bounds = await page
      .getByTestId('left-shortcuts')
      .locator('canvas')
      .boundingBox();
    expect(bounds).not.toBeNull();
    const client = {
      x: bounds!.x + expectedViewport.x * 1.5,
      y: bounds!.y + expectedViewport.y * 0.75,
    };
    const projected = await retained.evaluate(
      (coordinates, point) => coordinates.canvasToClient(point),
      world,
    );
    expect(projected!.x).toBeCloseTo(client.x, 3);
    expect(projected!.y).toBeCloseTo(client.y, 3);
    const restored = await retained.evaluate(
      (coordinates, point) => coordinates.clientToCanvas(point),
      client,
    );
    expect(restored!.x).toBeCloseTo(world.x, 3);
    expect(restored!.y).toBeCloseTo(world.y, 3);
    const viewport = await retained.evaluate(
      (coordinates, point) => coordinates.canvasToViewport(point),
      world,
    );
    expect(viewport!.x).toBeCloseTo(expectedViewport.x, 3);
    expect(viewport!.y).toBeCloseTo(expectedViewport.y, 3);
    const fromViewport = await retained.evaluate(
      (coordinates, point) => coordinates.viewportToCanvas(point),
      expectedViewport,
    );
    expect(fromViewport!.x).toBeCloseTo(world.x, 3);
    expect(fromViewport!.y).toBeCloseTo(world.y, 3);
  }
  await expect(page.getByTestId('left-undo')).toBeDisabled();
  await expect(page.getByTestId('right-undo')).toBeDisabled();
  await page.evaluate(() => window.setShown(['right']));
  await expect(page.getByTestId('left-shortcuts')).toHaveCount(0);
  expect(
    await retained.evaluate((coordinates) =>
      Object.values(coordinates).map((convert) => convert({ x: 10, y: 20 })),
    ),
  ).toEqual([null, null, null, null]);
  const rightPoint = await page.evaluate(() =>
    window.coordinates.right.canvasToViewport({ x: 100, y: 100 }),
  );
  expect(rightPoint!.x).toBeCloseTo(100, 3);
  expect(rightPoint!.y).toBeCloseTo(100, 3);
  await retained.dispose();
  expect(errors).toEqual([]);
});

for (const locale of ['en', 'zh']) {
  test(`palette drops place one undoable rectangle at the transformed pointer (${locale})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      document.addEventListener(
        'ic-ready',
        (event) => {
          const id = (event.target as HTMLElement).closest<HTMLElement>(
            '[data-canvas]',
          )?.dataset.canvas;
          if (id) window.apis[id] = (event as CustomEvent<ExtendedAPI>).detail;
        },
        true,
      );
      document.addEventListener(
        'drop',
        (event) => {
          document.body.dataset.dropPoint = JSON.stringify({
            x: event.clientX,
            y: event.clientY,
          });
        },
        true,
      );
    });
    await page.goto(`/?playground=${locale}`);
    const left = page.locator('[data-canvas="A"]');
    const right = page.locator('[data-canvas="B"]');
    const palette = left.locator('[data-action="place"]');
    const canvas = left.locator('canvas');
    await expect(palette).toBeEnabled({ timeout: 45000 });
    await expect(right.locator('[data-action="place"]')).toBeEnabled();
    const camera = { x: 50, y: -20, zoom: 1.6, rotation: Math.PI / 4 };
    await page.evaluate((camera) => {
      const scope = document.querySelector<HTMLElement>('[data-canvas="A"]')!;
      Object.assign(scope.style, {
        marginLeft: '100px',
        transform: 'scale(0.8, 0.9)',
        transformOrigin: 'top left',
      });
      window.apis.A.gotoLandmark(camera, { duration: 0 });
    }, camera);
    await expect
      .poll(() =>
        page.evaluate(() => window.apis.A.getAppState().cameraRotation),
      )
      .toBeCloseTo(camera.rotation, 5);
    await palette.dragTo(canvas, { targetPosition: { x: 120, y: 100 } });
    await expect(left.locator('[data-state="nodes"]')).toHaveText('3');
    await expect(left.locator('[data-state="selected"]')).toHaveText('1');
    await expect(right.locator('[data-state="nodes"]')).toHaveText('2');
    const result = await page.evaluate(() => {
      const api = window.apis.A;
      const node = api.getNodeById(api.getAppState().layersSelected[0])!;
      const bounds = api.getCanvasElement().getBoundingClientRect();
      return {
        node,
        bounds: { x: bounds.x, y: bounds.y },
        client: JSON.parse(document.body.dataset.dropPoint!),
      };
    });
    const viewport = {
      x: (result.client.x - result.bounds.x) / 0.8,
      y: (result.client.y - result.bounds.y) / 0.9,
    };
    const center = {
      x:
        camera.x +
        (Math.cos(camera.rotation) * viewport.x -
          Math.sin(camera.rotation) * viewport.y) /
          camera.zoom,
      y:
        camera.y +
        (Math.sin(camera.rotation) * viewport.x +
          Math.cos(camera.rotation) * viewport.y) /
          camera.zoom,
    };
    expect(Number(result.node.x) + 40).toBeCloseTo(center.x, 3);
    expect(Number(result.node.y) + 30).toBeCloseTo(center.y, 3);
    expect(result.node.width).toBe(80);
    expect(result.node.height).toBe(60);
    await left.locator('[data-action="undo"]').click();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('2');
    await expect(left.locator('[data-action="undo"]')).toBeDisabled();
    await left.locator('[data-action="redo"]').click();
    await expect(left.locator('[data-state="nodes"]')).toHaveText('3');
    expect(
      await page.evaluate(
        (id) => window.apis.A.getNodeById(id),
        result.node.id,
      ),
    ).toMatchObject({ x: result.node.x, y: result.node.y });
    await expect(right.locator('[data-action="undo"]')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}
