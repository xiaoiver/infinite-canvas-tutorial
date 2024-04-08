import type { Buffer, Device, RenderPass } from '@antv/g-device-api';

export abstract class Shape {
  abstract render(
    device: Device,
    renderPass: RenderPass,
    uniformBuffer: Buffer,
  ): void;
}
