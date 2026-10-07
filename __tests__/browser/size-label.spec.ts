import { expect, test, type Page } from '@playwright/test';
import type { BrowserHarness } from './fixtures/main';
import type { LineSerializedNode } from '@infinite-canvas-tutorial/ecs';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}

type Point = { x: number; y: number };
const settle = (page: Page) =>
  page.evaluate(() => window.canvasRegression.settleFrames());
const corners = (page: Page) =>
  page.evaluate(() => {
    const node = window.canvasRegression.state('left')!.nodes[0];
    return [
      [0, 0],
      [node.width!, 0],
      [node.width!, node.height!],
      [0, node.height!],
    ].map((point) =>
      window.canvasRegression.viewportPoint(
        'left',
        node.id,
        point as [number, number],
      ),
    );
  });

async function move(page: Page, point: Point) {
  const box = (await page.locator('#left canvas').boundingBox())!;
  await page.mouse.move(box.x + point.x, box.y + point.y);
  await settle(page);
}

// Read the actual CSS-transformed border box, including its transform origin.
async function labelGeometry(page: Page) {
  return page.evaluate(() => {
    const label = Array.from(
      document.querySelectorAll<HTMLDivElement>('#left div'),
    ).find(
      (element) =>
        element.style.visibility === 'visible' &&
        /^\d+ × \d+$/.test(element.innerText),
    );
    if (!label) throw new Error('Expected a visible size label');
    const style = getComputedStyle(label);
    const matrix = new DOMMatrix(style.transform);
    const [ox, oy] = style.transformOrigin.split(' ').map(parseFloat);
    const width =
      parseFloat(style.width) +
      parseFloat(style.paddingLeft) +
      parseFloat(style.paddingRight);
    const height =
      parseFloat(style.height) +
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom);
    const point = (x: number, y: number) => {
      const p = new DOMPoint(x - ox, y - oy).matrixTransform(matrix);
      return {
        x: parseFloat(style.left) + ox + p.x,
        y: parseFloat(style.top) + oy + p.y,
      };
    };
    return {
      text: label.innerText,
      anchor: point(width / 2, 0),
      corners: [
        point(0, 0),
        point(width, 0),
        point(width, height),
        point(0, height),
      ],
      down: { x: matrix.c, y: matrix.d },
    };
  });
}

async function expectOutsideLabel(page: Page) {
  const points = await corners(page);
  const center = {
    x: (points[0].x + points[2].x) / 2,
    y: (points[0].y + points[2].y) / 2,
  };
  const edges = points.map((a, index) => {
    const b = points[(index + 1) % 4];
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let nx = -(b.y - a.y) / length;
    let ny = (b.x - a.x) / length;
    if (nx * (midpoint.x - center.x) + ny * (midpoint.y - center.y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { midpoint, nx, ny };
  });
  const edge = edges.sort((a, b) => b.ny - a.ny)[0];
  const label = await labelGeometry(page);
  const zoom = await page.evaluate(
    () => window.canvasRegression.state('left')!.state.cameraZoom ?? 1,
  );
  const dimensions = label.text.split(' × ').map(Number);
  for (const [index, corner] of [points[1], points[3]].entries()) {
    const size =
      Math.hypot(corner.x - points[0].x, corner.y - points[0].y) / zoom;
    expect(Math.abs(dimensions[index] - size)).toBeLessThan(0.6);
  }
  expect(
    Math.hypot(
      label.anchor.x - edge.midpoint.x - edge.nx * 8,
      label.anchor.y - edge.midpoint.y - edge.ny * 8,
    ),
  ).toBeLessThan(0.2);
  expect(label.down.x * edge.nx + label.down.y * edge.ny).toBeCloseTo(1, 4);
  for (const p of label.corners) {
    expect(
      (p.x - edge.midpoint.x) * edge.nx + (p.y - edge.midpoint.y) * edge.ny,
    ).toBeGreaterThan(7.8);
  }
}

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 15000 });
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

for (const [name, rotation, cameraRotation, zoom, scaleX = 1, scaleY = 1] of [
  ['unrotated', 0, 0, 1],
  ['rotated', 0.55, 0, 1],
  ['past quarter turn', 2.05, 0, 1],
  ['half turn', Math.PI, 0, 1],
  ['rotated camera', 0, 0.3, 1.2],
  ['rotated shape and camera', 0.8, 0.3, 0.8],
  ['already horizontally flipped', 0.4, 0, 1, -1, 1],
  ['already vertically flipped', 0.4, 0, 1, 1, -1],
  ['scaled reflection', 0.2, 0.15, 0.8, -1.3, 0.7],
] as const) {
  test(`${name} size label stays outside while flipping both axes and reversing`, async ({
    page,
  }) => {
    await page.evaluate(
      async ({ rotation, cameraRotation, zoom, scaleX, scaleY }) => {
        await window.canvasRegression.setScene(
          'left',
          [
            {
              id: 'shape',
              type: 'rect',
              x: 140,
              y: 140,
              width: 60,
              height: 40,
              rotation,
              scaleX,
              scaleY,
              zIndex: 0,
              fills: [{ type: 'solid', value: '#ff8400' }],
            },
          ],
          'shape',
        );
        await window.canvasRegression.setPreferences('left', {
          flipEnabled: true,
          snapToObjectsEnabled: false,
          snapToPixelGridEnabled: false,
          cameraRotation,
          cameraZoom: zoom,
        });
      },
      { rotation, cameraRotation, zoom, scaleX, scaleY },
    );
    await settle(page);
    const original = await corners(page);
    await move(page, original[2]);
    await page.mouse.down();
    await settle(page);
    await move(page, original[0]);
    const collapsed = await labelGeometry(page);
    // Native mouse events quantize viewport coordinates; at rotated/zoomed
    // cameras the closest pixel can leave a small nonzero local dimension.
    for (const size of collapsed.text.split(' × ').map(Number)) {
      expect(size).toBeLessThanOrEqual(2);
    }
    expect(Number.isFinite(collapsed.anchor.x + collapsed.anchor.y)).toBe(true);
    for (const [x, y] of [
      [-1, 1],
      [-1, -1],
      [1, -1],
      [1.2, 1.2],
      [-1, -1],
    ]) {
      await move(page, {
        x:
          original[0].x +
          (original[1].x - original[0].x) * x +
          (original[3].x - original[0].x) * y,
        y:
          original[0].y +
          (original[1].y - original[0].y) * x +
          (original[3].y - original[0].y) * y,
      });
      await expectOutsideLabel(page);
    }
    await page.mouse.up();
    await settle(page);
    // A later gesture receives the reflected shape's decomposed OBB.
    const flipped = await corners(page);
    await move(page, flipped[2]);
    await page.mouse.down();
    await settle(page);
    await move(page, {
      x: flipped[0].x + (flipped[2].x - flipped[0].x) * 1.2,
      y: flipped[0].y + (flipped[2].y - flipped[0].y) * 1.2,
    });
    await expectOutsideLabel(page);
    if (name === 'unrotated') {
      await page
        .locator('#left')
        .screenshot({ path: test.info().outputPath('flipped-size-label.png') });
    }
    await page.mouse.up();
    await settle(page);
    await expect(
      page.locator('#left div[style*="visibility: visible"]'),
    ).toHaveCount(0);
  });
}

test('line labels stay centered and upright after reusing a rectangle label with a rotated camera', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.canvasRegression.setPreferences('left', {
      snapToObjectsEnabled: false,
      snapToPixelGridEnabled: false,
      cameraRotation: 0.3,
    }),
  );
  await page.evaluate(() =>
    window.canvasRegression.setScene(
      'left',
      [
        {
          id: 'shape',
          type: 'rect',
          x: 140,
          y: 100,
          width: 60,
          height: 40,
          zIndex: 0,
          fills: [{ type: 'solid', value: '#ff8400' }],
        },
      ],
      'shape',
    ),
  );
  await settle(page);
  const rect = await corners(page);
  await move(page, rect[2]);
  await page.mouse.down();
  await settle(page);
  await move(page, { x: rect[2].x + 30, y: rect[2].y + 20 });
  await expectOutsideLabel(page);
  await page.mouse.up();
  await settle(page);
  await page.evaluate(() =>
    window.canvasRegression.setScene(
      'left',
      [
        {
          id: 'shape',
          type: 'line',
          x: 130,
          y: 100,
          x1: 0,
          y1: 0,
          x2: 60,
          y2: 40,
          width: 60,
          height: 40,
          zIndex: 0,
          stroke: '#ff8400',
          strokeWidth: 2,
        },
      ],
      'shape',
    ),
  );
  await settle(page);
  const projected = (point: [number, number]) =>
    page.evaluate(
      (point) => window.canvasRegression.viewportPoint('left', 'shape', point),
      point,
    );
  const fixed = await projected([0, 0]);
  await move(page, await projected([60, 40]));
  await page.mouse.down();
  await settle(page);
  for (const point of [
    [80, -30],
    [-60, -30],
  ] as [number, number][]) {
    const target = await projected(point);
    await move(page, target);
    const [actualStart, actualEnd] = await page.evaluate(() => {
      const node = window.canvasRegression.state('left')!
        .nodes[0] as LineSerializedNode;
      return [
        [node.x1, node.y1],
        [node.x2, node.y2],
      ].map((p) =>
        window.canvasRegression.viewportPoint(
          'left',
          node.id,
          p as [number, number],
        ),
      );
    });
    expect(
      Math.hypot(actualStart.x - fixed.x, actualStart.y - fixed.y),
    ).toBeLessThan(0.1);
    const label = await labelGeometry(page);
    const center = {
      x: (label.corners[0].x + label.corners[2].x) / 2,
      y: (label.corners[0].y + label.corners[2].y) / 2,
    };
    expect(
      Math.hypot(
        center.x - (actualStart.x + actualEnd.x) / 2,
        center.y - (actualStart.y + actualEnd.y) / 2,
      ),
    ).toBeLessThan(0.2);
    const dx = actualEnd.x - actualStart.x;
    const dy = actualEnd.y - actualStart.y;
    const length = Math.hypot(dx, dy);
    expect(
      Math.abs(label.down.x * dx + label.down.y * dy) / length,
    ).toBeLessThan(0.001);
    expect(label.down.y).toBeGreaterThan(0);
  }
  await page.mouse.up();
  await settle(page);
});

test('touch flipping from a padded corner keeps the label outside the reflected shape', async ({
  page,
}) => {
  await page.evaluate(async () => {
    await window.canvasRegression.setScene(
      'left',
      [
        {
          id: 'shape',
          type: 'rect',
          x: 140,
          y: 100,
          width: 60,
          height: 40,
          zIndex: 0,
          fills: [{ type: 'solid', value: '#ff8400' }],
        },
      ],
      'shape',
    );
    await window.canvasRegression.setPreferences('left', {
      flipEnabled: true,
      snapToObjectsEnabled: false,
      snapToPixelGridEnabled: false,
    });
  });
  await settle(page);
  const canvas = page.locator('#left canvas');
  const box = (await canvas.boundingBox())!;
  const pointer = {
    pointerType: 'touch',
    pointerId: 1,
    isPrimary: true,
    bubbles: true,
    button: 0,
    buttons: 1,
    width: 20,
    height: 20,
  };
  await canvas.dispatchEvent('pointerdown', {
    ...pointer,
    clientX: box.x + 206,
    clientY: box.y + 146,
  });
  await settle(page);
  await canvas.dispatchEvent('pointermove', {
    ...pointer,
    clientX: box.x + 86,
    clientY: box.y + 66,
  });
  await settle(page);
  await expectOutsideLabel(page);
  await canvas.dispatchEvent('pointerup', {
    ...pointer,
    buttons: 0,
    clientX: box.x + 86,
    clientY: box.y + 66,
  });
  await settle(page);
});
