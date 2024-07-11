import { Buffer, Device, RenderPass } from '@antv/g-device-api';
import { Shape } from '../shapes';

export const ZINDEX_FACTOR = 100000;

export abstract class Drawcall {
  protected shapes: Shape[] = [];

  /**
   * Create a new batch if the number of instances exceeds.
   */
  protected maxInstances = Infinity;

  protected geometryDirty = true;
  protected materialDirty = true;

  constructor(protected device: Device, protected instanced: boolean) {}

  abstract createGeometry(): void;
  abstract createMaterial(uniformBuffer: Buffer): void;
  abstract render(renderPass: RenderPass): void;
  abstract destroy(): void;

  validate() {
    return this.count() <= this.maxInstances - 1;
  }

  submit(renderPass: RenderPass, uniformBuffer: Buffer) {
    if (this.geometryDirty) {
      this.createGeometry();
    }

    if (this.materialDirty) {
      this.createMaterial(uniformBuffer);
    }

    this.render(renderPass);

    if (this.geometryDirty) {
      this.geometryDirty = false;
    }

    if (this.materialDirty) {
      this.materialDirty = false;
    }
  }

  add(shape: Shape) {
    if (!this.shapes.includes(shape)) {
      this.shapes.push(shape);
      this.geometryDirty = true;
    }
  }

  remove(shape: Shape) {
    if (this.shapes.includes(shape)) {
      const index = this.shapes.indexOf(shape);
      this.shapes.splice(index, 1);
      this.geometryDirty = true;
    }
  }

  count() {
    return this.shapes.length;
  }
}
