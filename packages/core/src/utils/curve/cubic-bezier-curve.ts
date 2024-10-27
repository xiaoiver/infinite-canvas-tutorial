import { vec2 } from 'gl-matrix';
import { Curve } from './curve';
import { CubicBezier } from './interpolations';

export class CubicBezierCurve extends Curve {
  static TYPE = 'CubicBezierCurve';

  constructor(
    private v0 = vec2.create(),
    private v1 = vec2.create(),
    private v2 = vec2.create(),
    private v3 = vec2.create(),
  ) {
    super();
    this.type = CubicBezierCurve.TYPE;

    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    this.v3 = v3;
  }

  getPoint(t: number, optionalTarget = vec2.create()) {
    const point = optionalTarget;
    const { v0, v1, v2, v3 } = this;

    vec2.set(
      point,
      CubicBezier(t, v0[0], v1[0], v2[0], v3[0]),
      CubicBezier(t, v0[1], v1[1], v2[1], v3[1]),
    );

    return point;
  }

  // Line curve is linear, so we can overwrite default getPointAt
  getPointAt(u: number, optionalTarget) {
    return this.getPoint(u, optionalTarget);
  }
}
