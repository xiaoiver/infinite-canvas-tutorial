import { test, expect } from '@sand4rt/experimental-ct-web';
import { Button } from '../../packages/ui/src';

test('render props', async ({ mount }) => {
  const component = await mount(Button, {
    props: {
      title: 'Submit',
    },
  });
  await expect(component).toContainText('Submit');
});
