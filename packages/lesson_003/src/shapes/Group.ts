import { Device, RenderPass, Buffer } from '@antv/g-device-api';
import { Shape } from './Shape';

export class Group extends Shape {
  render(device: Device, renderPass: RenderPass, uniformBuffer: Buffer): void {}
  destroy(): void {}
}
