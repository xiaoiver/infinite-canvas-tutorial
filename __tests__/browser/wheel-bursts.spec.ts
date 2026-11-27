import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import { installProbes } from './fixtures/probes';
import type {} from './fixtures/core-path-instances';
import type {} from './fixtures/polyline-lod';
type WheelStep = Pick<
  WheelEventInit,
  | 'deltaX'
  | 'deltaY'
  | 'ctrlKey'
  | 'metaKey'
  | 'shiftKey'
  | 'clientX'
  | 'clientY'
>;
const cases: { name: string; steps: WheelStep[] }[] = [
  {
    name: 'pan samples',
    steps: [
      { deltaX: 20, deltaY: -10 },
      { deltaX: 8, deltaY: 6 },
      { deltaX: -4, deltaY: 2 },
    ],
  },
  {
    name: 'mixed zoom modes and pivots',
    steps: [
      { deltaY: -10, ctrlKey: true, clientX: 30, clientY: 70 },
      { deltaX: 20, deltaY: 3 },
      { deltaY: 15, metaKey: true, clientX: 160, clientY: 110 },
    ],
  },
  {
    name: 'zoom clamp reversal',
    steps: [
      { deltaY: -1000, ctrlKey: true },
      { deltaY: 10, ctrlKey: true },
      { deltaY: 1000, ctrlKey: true },
      { deltaY: -20, ctrlKey: true },
    ],
  },
];
for (const backend of ['core', 'ecs'] as const)
  for (const scenario of cases) {
    test(`${backend}: same-frame ${scenario.name} matches sequential input`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(installProbes);
      await page.goto(
        backend === 'core' ? '/core-path-instances.html' : '/polyline-lod.html',
      );
      await expect(page.locator('#status')).toHaveText('Ready');
      const reset = () =>
        page.evaluate(async (b) => {
          const view = { x: 12, y: -8, zoom: 2, rotation: Math.PI / 3 };
          return b === 'core'
            ? window.corePathInstances.navigationView(view)
            : await window.polylineLOD.navigationView(view);
        }, backend);
      const perform = (sequential: boolean) =>
        page.evaluate(
          async ({ backend, steps, sequential }) => {
            const read = () =>
              backend === 'core'
                ? window.corePathInstances.navigationView()
                : window.polylineLOD.navigationView();
            for (const step of steps) {
              document.querySelector('canvas')!.dispatchEvent(
                new WheelEvent('wheel', {
                  bubbles: true,
                  cancelable: true,
                  clientX: 100,
                  clientY: 100,
                  ...step,
                }),
              );
              if (sequential) await read();
            }
            const view = await read();
            const serialized =
              backend === 'core'
                ? window.corePathInstances.replayDocument()
                : window.polylineLOD.replayDocument();
            return { view, document: serialized };
          },
          { backend, steps: scenario.steps, sequential },
        );
      try {
        await reset();
        const sequential = await perform(true);
        await reset();
        const burst = await perform(false);
        for (const key of ['x', 'y', 'zoom', 'rotation'] as const)
          expect(burst.view[key]).toBeCloseTo(sequential.view[key], 3);
        expect(burst.document).toEqual(sequential.document);
        const idle = await page.evaluate(
          async (b) =>
            b === 'core'
              ? window.corePathInstances.navigationView()
              : await window.polylineLOD.navigationView(),
          backend,
        );
        expect(idle).toEqual(burst.view);
        expect(
          await page.evaluate(() =>
            document.querySelector('canvas')!.getContext('webgl2')!.getError(),
          ),
        ).toBe(0);
        expect(errors).toEqual([]);
      } finally {
        const baseline = await page.evaluate(
          async (b) =>
            b === 'core'
              ? window.corePathInstances.destroy()
              : await window.polylineLOD.destroy(),
          backend,
        );
        if (backend === 'core')
          expect(
            await page.evaluate(() => window.lifecycleProbes.resources()),
          ).toEqual(baseline);
        else
          expect(
            await page.evaluate(() => window.lifecycleProbes.leaks()),
          ).toEqual([]);
      }
    });
  }
