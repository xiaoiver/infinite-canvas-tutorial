import { expect, test, type Page } from '@playwright/test';
import type {
  RectSerializedNode,
  SerializedNode,
} from '../../packages/ecs/src/types/serialized-node';
import type { BrowserHarness } from './fixtures/main';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}

const frame = (page: Page) =>
  page.evaluate(() => window.canvasRegression.settleFrames());
async function pointer(page: Page, x: number, y: number) {
  const box = (await page.locator('#left canvas').boundingBox())!;
  await page.mouse.move(box.x + x, box.y + y);
  await frame(page);
}
const corners = (page: Page) =>
  page.evaluate(() => {
    const node = window.canvasRegression.state('left')!.nodes[0];
    return [
      [0, 0],
      [node.width!, 0],
      [node.width!, node.height!],
      [0, node.height!],
    ].map((p) =>
      window.canvasRegression.viewportPoint(
        'left',
        node.id,
        p as [number, number],
      ),
    );
  });

function expectPoint(actual: { x: number; y: number }, x: number, y: number) {
  expect(Math.abs(actual.x - x)).toBeLessThan(1);
  expect(Math.abs(actual.y - y)).toBeLessThan(1);
}
async function expectFrame(page: Page) {
  const points = await corners(page);
  const tf = await page.evaluate(() =>
    window.canvasRegression.transformer('left'),
  );
  tf.anchors
    .slice(0, 4)
    .forEach((p, i) => expectPoint(p, points[i].x, points[i].y));
}
async function press(page: Page, x: number, y: number) {
  await pointer(page, x, y);
  await page.mouse.down();
  await frame(page);
}
async function release(page: Page) {
  await page.mouse.up();
  await frame(page);
}

let errors: string[];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText('Ready', { timeout: 15000 });
  await page.evaluate(async () => {
    const node: RectSerializedNode = {
      id: 'shape',
      zIndex: 0,
      type: 'rect',
      x: 120,
      y: 60,
      width: 80,
      height: 60,
      fills: [{ type: 'solid', value: '#ff8400' }],
    };
    await window.canvasRegression.setScene('left', [node], node.id);
    await window.canvasRegression.setPreferences('left', {
      flipEnabled: true,
      snapToObjectsEnabled: false,
      snapToPixelGridEnabled: false,
    });
  });
  await frame(page);
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.canvasRegression.shutdown());
  expect(errors).toEqual([]);
});

test('right edge mirrors the shape across its fixed opposite edge', async ({
  page,
}) => {
  await pointer(page, 200, 90);
  await page.mouse.down();
  await frame(page);
  await pointer(page, 100, 90);
  const points = await corners(page);
  expect(points[0].x).toBeCloseTo(120, 2);
  expect(points[1].x).toBeCloseTo(100, 2);
  await release(page);
});

test('corner remains attached to the pointer after crossing and reversing', async ({
  page,
}) => {
  await pointer(page, 200, 120);
  await page.mouse.down();
  await frame(page);
  for (const [x, y] of [
    [100, 140],
    [80, 160],
    [160, 140],
    [200, 120],
  ]) {
    await pointer(page, x, y);
    const points = await corners(page);
    expect(points[0].x).toBeCloseTo(120, 2);
    expect(points[0].y).toBeCloseTo(60, 2);
    expect(points[2].x).toBeCloseTo(x, 2);
    expect(points[2].y).toBeCloseTo(y, 2);
  }
  await release(page);
});

for (const [name, start, target, bounds] of [
  ['left', [120, 90], [220, 90], [220, 60, 200, 120]],
  ['top', [160, 60], [160, 150], [120, 150, 200, 120]],
  ['bottom', [160, 120], [160, 30], [120, 60, 200, 30]],
  ['top left', [120, 60], [230, 150], [230, 150, 200, 120]],
  ['top right', [200, 60], [90, 150], [120, 150, 90, 120]],
  ['bottom left', [120, 120], [230, 30], [230, 60, 200, 30]],
  ['bottom right', [200, 120], [90, 30], [120, 60, 90, 30]],
] as const) {
  test(`${name} handle preserves the fixed opposite side through a flip`, async ({
    page,
  }) => {
    await press(page, start[0], start[1]);
    await pointer(page, target[0], target[1]);
    const [l, t, r, b] = bounds;
    const expected = [
      [l, t],
      [r, t],
      [r, b],
      [l, b],
    ];
    (await corners(page)).forEach((p, i) =>
      expectPoint(p, expected[i][0], expected[i][1]),
    );
    await expectFrame(page);
    await release(page);
    await expectFrame(page);
  });
}

test('crossing zero size and dragging back never loses the gesture baseline', async ({
  page,
}) => {
  await press(page, 200, 120);
  for (const [x, y] of [
    [120, 60],
    [90, 30],
    [120, 60],
    [230, 150],
  ]) {
    await pointer(page, x, y);
    const points = await corners(page);
    expectPoint(points[0], 120, 60);
    expectPoint(points[2], x, y);
  }
  await release(page);
});

for (const modifiers of [['Shift'], ['Alt'], ['Shift', 'Alt']] as const) {
  test(`${modifiers.join(
    '+',
  )} flipping preserves its ratio or center constraint`, async ({ page }) => {
    for (const key of modifiers) await page.keyboard.down(key);
    await press(page, 200, 120);
    for (const [x, y] of [
      [80, 30],
      [240, 150],
    ]) {
      await pointer(page, x, y);
      const points = await corners(page);
      if (modifiers.some((key) => key === 'Alt')) {
        expectPoint(
          {
            x: (points[0].x + points[2].x) / 2,
            y: (points[0].y + points[2].y) / 2,
          },
          160,
          90,
        );
      } else {
        expectPoint(points[0], 120, 60);
      }
      if (modifiers.some((key) => key === 'Shift')) {
        const width = Math.hypot(
          points[1].x - points[0].x,
          points[1].y - points[0].y,
        );
        const height = Math.hypot(
          points[3].x - points[0].x,
          points[3].y - points[0].y,
        );
        expect(width / height).toBeCloseTo(4 / 3, 3);
      }
      await expectFrame(page);
    }
    await release(page);
    for (const key of modifiers) await page.keyboard.up(key);
  });
}

for (const rotation of [Math.PI / 6, (Math.PI * 2) / 3, Math.PI]) {
  test(`rotated shape flips and reverses without a jump at ${rotation.toFixed(
    2,
  )} radians`, async ({ page }) => {
    await page.evaluate(
      (rotation) =>
        window.canvasRegression.update('left', 'shape', {
          x: 160,
          y: 100,
          rotation,
        }),
      rotation,
    );
    await frame(page);
    const world = (x: number, y: number) => ({
      x: 160 + x * Math.cos(rotation) - y * Math.sin(rotation),
      y: 100 + x * Math.sin(rotation) + y * Math.cos(rotation),
    });
    const start = world(80, 60);
    await press(page, start.x, start.y);
    for (const [x, y] of [
      [-40, 45],
      [-60, -30],
      [60, 45],
    ]) {
      const target = world(x, y);
      await pointer(page, target.x, target.y);
      const points = await corners(page);
      expectPoint(points[0], 160, 100);
      expectPoint(points[2], target.x, target.y);
      await expectFrame(page);
    }
    await release(page);
  });
}

test('a flipped shape can resize again and each gesture undoes independently', async ({
  page,
}) => {
  await press(page, 200, 90);
  await pointer(page, 80, 90);
  await release(page);
  await press(page, 80, 90);
  await pointer(page, 60, 90);
  await release(page);
  expectPoint((await corners(page))[1], 60, 60);
  for (const x of [80, 200]) {
    await page.evaluate(() => window.canvasRegression.undo('left'));
    await frame(page);
    expectPoint((await corners(page))[1], x, 60);
  }
  for (const x of [80, 60]) {
    await page.evaluate(() => window.canvasRegression.redo('left'));
    await frame(page);
    expectPoint((await corners(page))[1], x, 60);
  }
});

test('disabling flip clamps at the fixed edge and permits dragging back', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.canvasRegression.setPreferences('left', { flipEnabled: false }),
  );
  await press(page, 200, 90);
  await pointer(page, 80, 90);
  expectPoint((await corners(page))[0], 120, 60);
  expect((await corners(page))[1].x).toBeGreaterThan(120);
  await pointer(page, 230, 90);
  expectPoint((await corners(page))[1], 230, 60);
  await release(page);
});

test('multi-selection flips each member without losing its existing reflection', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.canvasRegression.setScene(
      'left',
      [
        {
          id: 'a',
          type: 'rect',
          x: 70,
          y: 60,
          width: 40,
          height: 30,
          zIndex: 0,
          fills: [{ type: 'solid', value: 'red' }],
        },
        {
          id: 'b',
          type: 'rect',
          x: 230,
          y: 90,
          width: 40,
          height: 30,
          scaleX: -1,
          zIndex: 1,
          fills: [{ type: 'solid', value: 'blue' }],
        },
      ],
      ['a', 'b'],
    ),
  );
  await frame(page);
  await press(page, 230, 90);
  await pointer(page, 40, 90);
  const actual = await page.evaluate(() =>
    window.canvasRegression
      .state('left')!
      .nodes.flatMap((n) => [
        window.canvasRegression.viewportPoint('left', n.id, [0, 0]),
        window.canvasRegression.viewportPoint('left', n.id, [
          n.width!,
          n.height!,
        ]),
      ]),
  );
  [
    [70, 60],
    [62.5, 90],
    [40, 90],
    [47.5, 120],
  ].forEach(([x, y], i) => expectPoint(actual[i], x, y));
  await release(page);
  const tf = await page.evaluate(() =>
    window.canvasRegression.transformer('left'),
  );
  expectPoint(tf.anchors[0], 40, 60);
  expectPoint(tf.anchors[2], 70, 120);
});

test('a mirrored shape rotates around its current center without changing its size', async ({
  page,
}) => {
  await press(page, 200, 90);
  await pointer(page, 80, 90);
  await release(page);
  const before = await corners(page);
  const pivot = { x: 100, y: 90 };
  const start = { x: 68, y: 128 };
  const angle = 0.5;
  const rotate = (p: { x: number; y: number }) => ({
    x:
      pivot.x +
      (p.x - pivot.x) * Math.cos(angle) -
      (p.y - pivot.y) * Math.sin(angle),
    y:
      pivot.y +
      (p.x - pivot.x) * Math.sin(angle) +
      (p.y - pivot.y) * Math.cos(angle),
  });
  await press(page, start.x, start.y);
  const target = rotate(start);
  await pointer(page, target.x, target.y);
  (await corners(page)).forEach((p, i) => {
    const expected = rotate(before[i]);
    expectPoint(p, expected.x, expected.y);
  });
  await expectFrame(page);
  await release(page);
});

test('gradient pixels are mirrored with the shape', async ({ page }) => {
  await page.evaluate(() =>
    window.canvasRegression.update('left', 'shape', {
      fills: [
        {
          type: 'gradient',
          value: 'linear-gradient(to right, #ff0000 0%, #0000ff 100%)',
        },
      ],
    }),
  );
  await frame(page);
  const before = await page.evaluate(() => [
    window.canvasRegression.pixel('left', 140, 80),
    window.canvasRegression.pixel('left', 180, 80),
  ]);
  expect(before[0][0]).toBeGreaterThan(before[0][2]);
  expect(before[1][2]).toBeGreaterThan(before[1][0]);
  await press(page, 200, 90);
  await pointer(page, 40, 90);
  await release(page);
  const after = await page.evaluate(() => [
    window.canvasRegression.pixel('left', 100, 80),
    window.canvasRegression.pixel('left', 60, 80),
  ]);
  after.forEach((pixel, i) =>
    pixel.forEach((channel, j) =>
      expect(Math.abs(channel - before[i][j])).toBeLessThan(8),
    ),
  );
});

for (const type of ['path', 'polyline', 'vector-network'] as const) {
  test(`${type} mirrors asymmetric geometry exactly once`, async ({ page }) => {
    await page.evaluate(async (type) => {
      const node = {
        id: 'shape',
        type,
        x: 120,
        y: 60,
        width: 80,
        height: 60,
        zIndex: 0,
        fills: [{ type: 'solid', value: '#ff8400' }],
        strokes: [{ type: 'solid', value: '#222' }],
        strokeWidth: 0,
        ...(type === 'path'
          ? { d: 'M0 0 L80 15 L40 60 Z' }
          : type === 'polyline'
          ? { points: '0,0 80,15 40,60' }
          : {
              vertices: [
                { x: 0, y: 0 },
                { x: 80, y: 15 },
                { x: 40, y: 60 },
              ],
              segments: [
                { start: 0, end: 1 },
                { start: 1, end: 2 },
                { start: 2, end: 0 },
              ],
            }),
      } as SerializedNode;
      await window.canvasRegression.setScene('left', [node], node.id);
    }, type);
    await frame(page);
    await press(page, 200, 90);
    await pointer(page, 80, 90);
    await release(page);
    const actual = await page.evaluate(() => {
      const n = window.canvasRegression.state('left')!.nodes[0];
      const points =
        n.type === 'path'
          ? [...n.d.matchAll(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map((m) =>
              Number(m[0]),
            )
          : n.type === 'polyline'
          ? n.points.split(/[ ,]+/).map(Number)
          : n.type === 'vector-network'
          ? n.vertices.flatMap((v) => [v.x, v.y])
          : [];
      return [0, 2, 4].map((i) =>
        window.canvasRegression.viewportPoint('left', n.id, [
          points[i],
          points[i + 1],
        ]),
      );
    });
    [
      [120, 60],
      [80, 75],
      [100, 120],
    ].forEach(([x, y], i) => expectPoint(actual[i], x, y));
  });
}
