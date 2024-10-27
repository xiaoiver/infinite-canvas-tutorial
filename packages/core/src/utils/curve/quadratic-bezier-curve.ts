import { vec2 } from 'gl-matrix';
import { Curve } from './curve';
import { QuadraticBezier } from './interpolations';

export class QuadraticBezierCurve extends Curve {
  static TYPE = 'QuadraticBezierCurve';

  constructor(
    private v0 = vec2.create(),
    private v1 = vec2.create(),
    private v2 = vec2.create(),
  ) {
    super();
    this.type = QuadraticBezierCurve.TYPE;

    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
  }

  getPoint(t: number, optionalTarget = vec2.create()) {
    const point = optionalTarget;
    const { v0, v1, v2 } = this;

    vec2.set(
      point,
      QuadraticBezier(t, v0[0], v1[0], v2[0]),
      QuadraticBezier(t, v0[1], v1[1], v2[1]),
    );

    return point;
  }

  // Line curve is linear, so we can overwrite default getPointAt
  getPointAt(u: number, optionalTarget) {
    return this.getPoint(u, optionalTarget);
  }
}
