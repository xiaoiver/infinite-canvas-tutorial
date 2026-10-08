import { expect, test, type Page } from '@playwright/test';
import type { BrowserHarness } from './fixtures/main';

declare global {
  interface Window {
    canvasRegression: BrowserHarness;
  }
}
type Point = { x: number; y: number };
const normalize = ({ x, y }: Point) => {
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
};
const subtract = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });

async function cursorDirection(
  page: Page,
  point: Point,
  kind: 'corner' | 'edge' | 'rotate',
) {
  const box = (await page.locator('#left canvas').boundingBox())!;
  await page.mouse.move(box.x + point.x, box.y + point.y);
  await page.evaluate(() => window.canvasRegression.settleFrames());
  return page.locator('#left canvas').evaluate((canvas, kind) => {
    const css = getComputedStyle(canvas).cursor;
    const source = css.match(/<svg.*<\/svg>/)?.[0];
    if (!source) throw new Error(`Expected a custom handle cursor, got ${css}`);
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
    const group = svg.querySelector<SVGGElement>('g[transform]')!;
    const m = group.transform.baseVal.consolidate()!.matrix;
    // Canonical artwork: corner arrows point NE/SW, edges E/W, and the
    // rotation arc wraps the NW corner. Compare them with actual screen axes.
    const [x, y] =
      kind === 'edge' ? [1, 0] : kind === 'corner' ? [1, -1] : [-1, -1];
    return {
      direction: { x: m.a * x + m.c * y, y: m.b * x + m.d * y },
      determinant: m.a * m.d - m.b * m.c,
      center: { x: m.a * 16 + m.c * 16 + m.e, y: m.b * 16 + m.d * 16 + m.f },
      rotateArtwork: !!svg.querySelector('[clip-rule]'),
    };
  }, kind);
}

for (const [scaleX, scaleY] of [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
]) {
  for (const [rotation, cameraRotation] of [
    [0, 0],
    [0.52, 0],
    [2.09, 0],
    [0.52, 0.18],
  ]) {
    test(`handle cursors follow flip ${scaleX}/${scaleY}, rotation ${rotation}, camera ${cameraRotation}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/');
      await expect(page.locator('#status')).toHaveText('Ready');
      const corners = await page.evaluate(
        async ({ scaleX, scaleY, rotation, cameraRotation }) => {
          const api = window.canvasRegression;
          const w = 80,
            h = 60;
          const node = {
            id: 'cursor-shape',
            type: 'rect' as const,
            width: w,
            height: h,
            x:
              160 -
              (w / 2) * scaleX * Math.cos(rotation) +
              (h / 2) * scaleY * Math.sin(rotation),
            y:
              110 -
              (w / 2) * scaleX * Math.sin(rotation) -
              (h / 2) * scaleY * Math.cos(rotation),
            rotation,
            scaleX,
            scaleY,
            zIndex: 0,
            fills: [{ type: 'solid' as const, value: 'orange' }],
          };
          await api.setScene('left', [node], node.id);
          await api.setPreferences('left', {
            cameraRotation,
            snapToObjectsEnabled: false,
            snapToPixelGridEnabled: false,
          });
          await api.settleFrames();
          return [
            [0, 0],
            [w, 0],
            [w, h],
            [0, h],
          ].map((p) =>
            api.viewportPoint('left', node.id, p as [number, number]),
          );
        },
        { scaleX, scaleY, rotation, cameraRotation },
      );
      const axisX = normalize(subtract(corners[1], corners[0]));
      const axisY = normalize(subtract(corners[3], corners[0]));
      const directions = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) =>
        normalize({
          x: x * axisX.x + y * axisY.x,
          y: x * axisX.y + y * axisY.y,
        }),
      );

      for (let i = 0; i < 4; i++) {
        for (const kind of ['corner', 'rotate'] as const) {
          const outward = directions[i];
          const point = {
            x: corners[i].x + (kind === 'rotate' ? outward.x * 14 : 0),
            y: corners[i].y + (kind === 'rotate' ? outward.y * 14 : 0),
          };
          const cursor = await cursorDirection(page, point, kind);
          expect(cursor.rotateArtwork).toBe(kind === 'rotate');
          const direction = normalize(cursor.direction);
          const dot = direction.x * outward.x + direction.y * outward.y;
          expect(kind === 'rotate' ? dot : Math.abs(dot)).toBeCloseTo(1, 5);
          expect(cursor.determinant).toBeCloseTo(scaleX * scaleY, 5);
          expect(cursor.center.x).toBeCloseTo(16, 5);
          expect(cursor.center.y).toBeCloseTo(16, 5);
        }
        const next = corners[(i + 1) % 4];
        const cursor = await cursorDirection(
          page,
          {
            x: (corners[i].x + next.x) / 2,
            y: (corners[i].y + next.y) / 2,
          },
          'edge',
        );
        expect(cursor.rotateArtwork).toBe(false);
        const direction = normalize(cursor.direction);
        const axis = i % 2 === 0 ? axisY : axisX;
        expect(
          Math.abs(direction.x * axis.x + direction.y * axis.y),
        ).toBeCloseTo(1, 5);
      }
      expect(errors).toEqual([]);
    });
  }
}
