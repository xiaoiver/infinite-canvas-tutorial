import { expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type { FillCase } from './fixtures/ecs-path-fill';

function compare(result: { actual: string; reference: string; mask: string }) {
  const decode = (url: string) =>
    PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
  const reference = decode(result.reference);
  for (const name of ['actual', 'mask'] as const) {
    const actual = decode(result[name]);
    expect([actual.width, actual.height]).toEqual([
      reference.width,
      reference.height,
    ]);
    let checked = 0;
    let maxError = 0;
    // Ignore only native edge antialiasing. Interior holes, overlap alpha and
    // seams between tessellated triangles must match both native fill and mask.
    for (let y = 2; y < reference.height - 2; y++) {
      for (let x = 2; x < reference.width - 2; x++) {
        const offset = (y * reference.width + x) * 4;
        const alpha = reference.data[offset + 3];
        if (![0, 128].includes(alpha)) continue;
        if (
          [-2, 0, 2].some((dy) =>
            [-2, 0, 2].some(
              (dx) =>
                reference.data[
                  ((y + dy) * reference.width + x + dx) * 4 + 3
                ] !== alpha,
            ),
          )
        )
          continue;
        checked++;
        const channels = alpha ? [0, 1, 2, 3] : [3];
        for (const channel of channels)
          maxError = Math.max(
            maxError,
            Math.abs(
              actual.data[offset + channel] - reference.data[offset + channel],
            ),
          );
      }
    }
    expect(checked).toBeGreaterThan(10000);
    expect(maxError, name).toBeLessThanOrEqual(2);
  }
}
const outer = 'M10 10H150V130H10Z';
const inner = 'M40 40H120V100H40Z';
const cases: [string, FillCase][] = [
  ['same-direction evenodd hole', { d: `${outer} ${inner}`, rule: 'evenodd' }],
  [
    'same-direction nonzero interior',
    { d: `${outer} ${inner}`, rule: 'nonzero' },
  ],
  [
    'hole before outline',
    { d: `M40 40V100H120V40Z ${outer}`, rule: 'nonzero' },
  ],
  [
    'nested island and mirrored contours',
    { d: `M60 60H100V80H60Z ${outer} ${inner}`, rule: 'evenodd', mirror: true },
  ],
  [
    'overlapping parity',
    { d: 'M10 10H110V110H10Z M60 10H160V110H60Z', rule: 'evenodd' },
  ],
  [
    'overlapping winding union',
    { d: 'M10 10H110V110H10Z M60 10H160V110H60Z', rule: 'nonzero' },
  ],
  [
    'separate outlines and repeated closing points',
    { d: 'M10 10H60V60H10Z M100 60V10H150V60H100Z', rule: 'evenodd' },
  ],
  [
    'identical geometry with different rules',
    { d: `${outer} ${inner}`, rule: 'nonzero', secondRule: 'evenodd' },
  ],
];
for (const [name, options] of cases) {
  test(`ECS fill and filter mask match native ${name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/ecs-path-fill.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    compare(
      await page.evaluate(
        (options) => window.pathFillTest.render(options),
        options,
      ),
    );
    expect(errors).toEqual([]);
  });
}

test('live fill-rule changes rebuild the mesh and retain parity after switching tessellators', async ({
  page,
}) => {
  await page.goto('/ecs-path-fill.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  compare(
    await page.evaluate(
      (d) => window.pathFillTest.render({ d, rule: 'nonzero' }),
      `${outer} ${inner}`,
    ),
  );
  for (const rule of ['evenodd', 'nonzero', 'evenodd'] as const)
    compare(
      await page.evaluate((rule) => window.pathFillTest.updateRule(rule), rule),
    );
  for (const method of ['libtess', 'earcut'] as const) {
    const result = await page.evaluate(
      (method) => window.pathFillTest.updateMethod(method),
      method,
    );
    expect(result.method).toBe(method);
    compare(result);
  }
});
