import { test, expect } from '@sand4rt/experimental-ct-web';
import { ZoomToolbar } from '../../packages/ui/src';

test('should display zoom correctly.', async ({ mount }) => {
  const component = await mount(ZoomToolbar, {
    props: {
      zoom: 100,
    },
  });
  await expect(component).toContainText('100%');
});
