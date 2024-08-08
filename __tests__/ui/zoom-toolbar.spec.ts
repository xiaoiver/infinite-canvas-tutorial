import { test, expect } from '@sand4rt/experimental-ct-web';
import { ZoomToolbar } from '../../packages/ui/src';

test('render props', async ({ mount }) => {
  const component = await mount(ZoomToolbar, {
    props: {
      title: 'Submit',
    },
  });
  await expect(component).toContainText('Submit');
});
