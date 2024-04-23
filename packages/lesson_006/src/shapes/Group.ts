import { Device, RenderPass, Buffer } from '@antv/g-device-api';
import { Shape } from './Shape';

export class Group extends Shape {
  renderable = false;

  containsPoint(x: number, y: number): boolean {
    throw new Error('Method not implemented.');
  }
  render(device: Device, renderPass: RenderPass, uniformBuffer: Buffer): void {}
  destroy(): void {}
}
