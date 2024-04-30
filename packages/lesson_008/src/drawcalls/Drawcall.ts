import { Buffer, Device, Program, RenderPass } from '@antv/g-device-api';
import { Shape } from '../shapes';

export class Drawcall {
  shapes: Shape[] = [];
  get instance() {
    return this.shapes[0];
  }

  instanced: boolean;

  protected program: Program;

  /**
   * Create a new batch if the number of instances exceeds.
   */
  maxInstances = Infinity;

  index = 0;

  geometryDirty = true;

  constructor(protected device: Device) {}

  shouldMerge(shape: Shape, index: number) {
    if (!this.instance) {
      return true;
    }

    if (this.instance.constructor !== shape.constructor) {
      return false;
    }

    return true;
  }

  protected init() {}
  protected render(renderPass: RenderPass, uniformBuffer: Buffer) {}

  submit(renderPass: RenderPass, uniformBuffer: Buffer) {
    if (!this.program) {
      this.init();
    }

    this.render(renderPass, uniformBuffer);
  }

  destroy() {
    this.program.destroy();
  }
}
