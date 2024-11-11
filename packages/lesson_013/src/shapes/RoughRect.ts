import { RectWrapper, RectAttributes } from './Rect';
import { filterUndefined, generator } from '../utils';
import { IRough, Rough } from './mixins/Rough';
import { Shape } from './Shape';

export interface RoughRectAttributes extends RectAttributes, IRough {}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class RoughRect extends Rough(RectWrapper(Shape)) {
  constructor(attributes: Partial<RoughRectAttributes> = {}) {
    super(attributes);
  }

  generateDrawable() {
    const {
      x,
      y,
      width,
      height,
      fill,
      stroke,
      strokeWidth,
      seed,
      bowing,
      roughness,
      fillStyle,
      fillWeight,
    } = this;

    return generator.rectangle(
      x,
      y,
      width,
      height,
      filterUndefined({
        fill: fill as string,
        stroke,
        strokeWidth,
        seed,
        bowing,
        roughness,
        fillStyle,
        fillWeight,
      }),
    );
  }
}
