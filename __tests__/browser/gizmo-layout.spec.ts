import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

for (const extrude of [false, true]) {
  for (const reason of ['padding', 'flex-grow'] as const) {
    test(`${extrude ? 'extrusion' : 'mesh'} yields to Yoga ${reason}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/gizmo.html?yoga${extrude ? '&extrude' : ''}`);
      await expect(page.locator('#status')).toHaveText('Ready');
      const before = await page.evaluate(() => window.gizmoTest.state());
      expect(before.origin).toEqual({ x: 60, y: 60 });
      await page.mouse.move(125, 80);
      await page.mouse.down();
      await expect
        .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
        .toBe(true);
      await page.mouse.move(145, 80, { steps: 4 });
      await page.evaluate(() => window.gizmoTest.settle());
      expect(
        (await page.evaluate(() => window.gizmoTest.state())).translation[0],
      ).toBeCloseTo(100);

      // Run the actual Yoga plugin; x/y/width/height remain unchanged on wire.
      await page.evaluate(async (reason) => {
        await window.gizmoTest.api().edit(
          (api) =>
            reason === 'padding'
              ? api.updateNode(api.getNodeById('layout'), {
                  padding: [40, 30],
                })
              : api.updateNode(api.getNodeById('model'), { flexGrow: 1 }),
          { capture: 'NEVER' },
        );
        await window.gizmoTest.settle();
      }, reason);
      await expect
        .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
        .toBe(false);
      const layout = await page.evaluate(() => window.gizmoTest.state());
      expect(layout.origin).toEqual(
        reason === 'padding' ? { x: 30, y: 40 } : { x: 60, y: 60 },
      );
      expect(layout.size).toEqual({
        width: reason === 'padding' ? 40 : 80,
        height: 40,
      });
      for (const key of ['x', 'y', 'width', 'height'] as const)
        expect(layout.node[key]).toBe(before.node[key]);
      expect(layout.translation).toEqual(
        reason === 'padding' ? [50, 60, 0] : [100, 80, 0],
      );
      await page.mouse.move(175, 80);
      await page.mouse.up();
      await page.evaluate(() => window.gizmoTest.settle());
      const released = await page.evaluate(() => window.gizmoTest.state());
      expect(released.dragging).toBe(false);
      expect(released.node).toEqual(layout.node);
      expect(released.origin).toEqual(layout.origin);
      expect(released.translation).toEqual(layout.translation);
      expect(
        await page.evaluate(
          () => window.gizmoTest.api().getHistoryState().canUndo,
        ),
      ).toBe(false);

      // A fresh gesture uses the new center; Escape restores the computed origin.
      const [x, y] = layout.translation;
      await page.mouse.move(x + 45, y);
      await page.mouse.down();
      await expect
        .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
        .toBe(true);
      await page.mouse.move(x + 55, y, { steps: 4 });
      await page.evaluate(() => window.gizmoTest.settle());
      expect(
        (await page.evaluate(() => window.gizmoTest.state())).translation[0],
      ).toBeCloseTo(x + 10);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await page.evaluate(() => window.gizmoTest.settle());
      const cancelled = await page.evaluate(() => window.gizmoTest.state());
      expect(cancelled.dragging).toBe(false);
      expect(cancelled.origin).toEqual(layout.origin);
      expect(cancelled.translation).toEqual(layout.translation);
      expect(cancelled.node).toEqual(layout.node);
      expect(errors).toEqual([]);
    });
  }
}
