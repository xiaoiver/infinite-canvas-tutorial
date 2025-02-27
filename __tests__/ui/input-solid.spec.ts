import { test, expect } from '@sand4rt/experimental-ct-web';
import { InputSolid } from '../../packages/ui/src';

test('should display input solid correctly.', async ({ mount }) => {
  const component = await mount(InputSolid, {
    props: {
      rgb: 'rgb(255, 255, 255)',
      opacity: 1,
    },
  });
  await expect(component.locator('label').first()).toBeVisible();
  await expect(component.locator('sl-color-picker')).toBeVisible();
  await expect(component).toContainText('Select a color');

  // await expect(
  //   component
  //     .locator('sl-color-picker')
  //     .locator('button .color-dropdown__trigger'),
  // ).toHaveAttribute('style', 'color: rgba(255, 255, 255, 1)');
  // await component.locator('sl-color-picker').click();
});
