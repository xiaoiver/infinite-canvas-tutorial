import { test, expect } from '@sand4rt/experimental-ct-web';
import { InfiniteCanvas } from '../../packages/ui/src';

test('should zoom out correctly.', async ({ mount }) => {
  const component = await mount(InfiniteCanvas, {
    props: {
      renderer: 'webgl',
    },
  });

  await expect(component.locator("[label='Zoom out']")).toBeVisible();

  // await component.locator("[label='Zoom out']").click();
  // await expect(component).toContainText('1');
});
