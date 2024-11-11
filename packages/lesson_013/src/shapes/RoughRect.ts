import { RectWrapper, RectAttributes } from './Rect';
import { generator } from '../utils';
import { IRough, Rough } from './mixins/Rough';
import { Shape } from './Shape';

export interface RoughRectAttributes extends RectAttributes, IRough {}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class RoughRect extends Rough(RectWrapper(Shape)) {
  constructor(attributes: Partial<RoughRectAttributes> = {}) {
    super(attributes);

    // x / y / width / height also regenerates the drawable
    this.onGeometryChanged = () => {
      this.geometryDirtyFlag = true;
      this.generate();
    };
  }

  generateDrawable() {
    const { x, y, width, height } = this;

    return generator.rectangle(x, y, width, height, this.roughOptions);
  }
}
