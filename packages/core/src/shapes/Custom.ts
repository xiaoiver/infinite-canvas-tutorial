import { RenderPass } from '@antv/g-device-api';
import { Shape, ShapeAttributes } from './Shape';
import { GConstructor } from './mixins';
import { AABB } from './AABB';

export interface CustomAttributes extends ShapeAttributes {
  render: (
    renderPass: RenderPass,
    uniformLegacyObject: Record<string, unknown>,
  ) => void;
}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class Custom extends CustomWrapper(Shape) {}

export function CustomWrapper<TBase extends GConstructor>(Base: TBase) {
  // @ts-expect-error - Mixin class
  return class CustomWrapper extends Base implements CustomAttributes {
    batchable = false;
    cullable = false;

    getGeometryBounds() {
      return new AABB(0, 0, 0, 0);
    }

    getRenderBounds() {
      return new AABB(0, 0, 0, 0);
    }

    render: (
      renderPass: RenderPass,
      uniformLegacyObject: Record<string, unknown>,
    ) => void;

    constructor(attributes: Partial<CustomAttributes> = {}) {
      super(attributes);

      const { render } = attributes;

      this.render = render;
    }
  };
}
