import { vec2 } from 'gl-matrix';
import { Curve } from './curve';

export class LineCurve extends Curve {
  static TYPE = 'LineCurve';

  constructor(private v1 = vec2.create(), private v2 = vec2.create()) {
    super();
    this.type = LineCurve.TYPE;

    this.v1 = v1;
    this.v2 = v2;
  }

  getPoint(t: number, optionalTarget = vec2.create()) {
    const point = optionalTarget;

    if (t === 1) {
      vec2.copy(point, this.v2);
    } else {
      vec2.sub(point, vec2.copy(point, this.v2), this.v1);
      vec2.scaleAndAdd(point, this.v1, point, t);
    }

    return point;
  }

  // Line curve is linear, so we can overwrite default getPointAt
  getPointAt(u: number, optionalTarget?: any) {
    return this.getPoint(u, optionalTarget);
  }
}
