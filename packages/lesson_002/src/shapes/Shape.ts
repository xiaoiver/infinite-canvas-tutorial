import type { Buffer, Device, RenderPass } from '@antv/g-device-api';

export abstract class Shape {
  /**
   * Avoid unnecessary work like updating Buffer by deferring it until needed.
   * @see https://gameprogrammingpatterns.com/dirty-flag.html
   */
  protected renderDirtyFlag = true;

  abstract render(
    device: Device,
    renderPass: RenderPass,
    uniformBuffer: Buffer,
  ): void;

  abstract destroy(): void;
}
