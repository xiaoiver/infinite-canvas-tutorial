import { CircleWrapper, CircleAttributes } from './Circle';
import { generator } from '../utils';
import { IRough, Rough } from './mixins/Rough';
import { Shape } from './Shape';

export interface RoughCircleAttributes extends CircleAttributes, IRough {}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class RoughCircle extends Rough(CircleWrapper(Shape)) {
  constructor(attributes: Partial<RoughCircleAttributes> = {}) {
    super(attributes);
  }

  generateDrawable() {
    const { cx, cy, r } = this;

    return generator.circle(cx, cy, r * 2, this.roughOptions);
  }
}
