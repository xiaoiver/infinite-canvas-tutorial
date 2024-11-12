import { PolylineWrapper, PolylineAttributes } from './Polyline';
import { generator } from '../utils';
import { IRough, Rough } from './mixins/Rough';
import { Shape } from './Shape';

export interface RoughPolylineAttributes extends PolylineAttributes, IRough {}

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-redeclare
export class RoughPolyline extends Rough(PolylineWrapper(Shape)) {
  constructor(attributes: Partial<RoughPolylineAttributes> = {}) {
    super(attributes);

    // points also regenerates the drawable
    this.onGeometryChanged = () => {
      this.geometryDirtyFlag = true;
      this.generate();
    };
  }

  generateDrawable() {
    const { points } = this;

    return generator.linearPath(points, this.roughOptions);
  }
}
