import { Buffer, RenderPass } from '@antv/g-device-api';
import { Drawcall, ZINDEX_FACTOR } from './Drawcall';
import { Custom as CustomShape } from '../shapes';

export class Custom extends Drawcall {
  validate() {
    return false;
  }

  createGeometry(): void {
    // throw new Error('Method not implemented.');
  }
  createMaterial(define: string, uniformBuffer: Buffer): void {
    // throw new Error('Method not implemented.');
  }
  render(
    renderPass: RenderPass,
    uniformLegacyObject: Record<string, unknown>,
  ): void {
    const instance = this.shapes[0] as CustomShape;
    if (!instance) {
      return;
    }

    instance.render(renderPass, uniformLegacyObject);
  }
}
