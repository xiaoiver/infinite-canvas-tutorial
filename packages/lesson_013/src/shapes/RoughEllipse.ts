import { EllipseWrapper, EllipseAttributes } from './Ellipse';
import { generator } from '../utils';
import { IRough, Rough } from './mixins/Rough';
import { Shape } from './Shape';

export interface RoughEllipseAttributes extends EllipseAttributes, IRough {}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class RoughEllipse extends Rough(EllipseWrapper(Shape)) {
  constructor(attributes: Partial<RoughEllipseAttributes> = {}) {
    super(attributes);

    // cx / cy / rx / ry also regenerates the drawable
    this.onGeometryChanged = () => {
      this.geometryDirtyFlag = true;
    };
  }

  generateDrawable() {
    const { cx, cy, rx, ry } = this;

    return generator.ellipse(cx, cy, rx * 2, ry * 2, this.roughOptions);
  }
}
