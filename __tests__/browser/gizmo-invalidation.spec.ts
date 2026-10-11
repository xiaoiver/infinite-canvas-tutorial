import { expect } from '@playwright/test';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

for (const extrude of [false, true]) {
  for (const reason of ['camera', 'document'] as const) {
    test(`${
      extrude ? 'extrusion' : 'mesh'
    } drag yields to a ${reason} edit`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/gizmo.html${extrude ? '?extrude' : ''}`);
      await expect(page.locator('#status')).toHaveText('Ready');
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
      await page.evaluate(async (reason) => {
        const api = window.gizmoTest.api();
        await api.edit(
          (editor) => {
            if (reason === 'camera')
              editor.gotoLandmark({ x: 10, zoom: 1.5 }, { duration: 0 });
            else
              editor.updateNode(editor.getNodeById('model'), {
                x: 30,
                name: 'external',
              });
          },
          { capture: 'NEVER' },
        );
        await window.gizmoTest.settle();
      }, reason);
      const interrupted = await page.evaluate(() => window.gizmoTest.state());
      expect(interrupted.dragging).toBe(false);
      expect(interrupted.node.x).toBe(reason === 'camera' ? 60 : 30);
      expect(interrupted.translation[0]).toBe(reason === 'camera' ? 80 : 50);
      await page.mouse.move(175, 80);
      await page.mouse.up();
      await page.evaluate(() => window.gizmoTest.settle());
      const released = await page.evaluate(() => window.gizmoTest.state());
      expect(released.node).toEqual(interrupted.node);
      expect(released.translation).toEqual(interrupted.translation);
      expect(
        await page.evaluate(
          () => window.gizmoTest.api().getHistoryState().canUndo,
        ),
      ).toBe(false);
      // The next press must start a fresh, usable gesture in the new view.
      const start = await page.evaluate(() => {
        const api = window.gizmoTest.api();
        const state = window.gizmoTest.state();
        return api.canvas2Viewport({
          x: state.translation[0],
          y: state.translation[1],
        });
      });
      await page.mouse.move(start.x + 45, start.y);
      await page.evaluate(() => window.gizmoTest.settle());
      await page.mouse.down();
      await expect
        .poll(() => page.evaluate(() => window.gizmoTest.state().dragging))
        .toBe(true);
      await page.mouse.move(start.x + 60, start.y, { steps: 4 });
      await page.mouse.up();
      await page.evaluate(() => window.gizmoTest.settle());
      expect(
        (await page.evaluate(() => window.gizmoTest.state())).node.x,
      ).toBeCloseTo(
        (reason === 'camera' ? 60 : 30) + 15 / (reason === 'camera' ? 1.5 : 1),
      );
      expect(errors).toEqual([]);
    });
  }
}
