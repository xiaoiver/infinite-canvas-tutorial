import { Buffer, Device, RenderPass } from '@antv/g-device-api';
import { Shape } from '../shapes';
import { RenderCache } from '../utils/render-cache';
import { uid } from '../utils';

// TODO: Use a more efficient way to manage Z index.
export const ZINDEX_FACTOR = 100000;

export abstract class Drawcall {
  uid = uid();

  shapes: Shape[] = [];

  /**
   * Create a new batch if the number of instances exceeds.
   */
  protected maxInstances = Infinity;

  geometryDirty = true;
  materialDirty = true;
  destroyed = false;

  constructor(
    protected device: Device,
    protected renderCache: RenderCache,
    protected instanced: boolean,
    protected index: number,
  ) {}

  abstract createGeometry(): void;
  abstract createMaterial(uniformBuffer: Buffer): void;
  abstract render(
    renderPass: RenderPass,
    uniformLegacyObject: Record<string, unknown>,
  ): void;

  destroy() {
    this.destroyed = true;
  }

  validate(_: Shape) {
    return this.count() <= this.maxInstances - 1;
  }

  submit(
    renderPass: RenderPass,
    uniformBuffer: Buffer,
    uniformLegacyObject: Record<string, unknown>,
  ) {
    if (this.geometryDirty) {
      this.createGeometry();
    }

    if (this.materialDirty) {
      this.createMaterial(uniformBuffer);
    }

    this.render(renderPass, uniformLegacyObject);

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
