import { vec2 } from 'gl-matrix';
import { Curve } from './curve';

export class EllipseCurve extends Curve {
  aX: number;
  aY: number;
  xRadius: number;
  yRadius: number;
  aStartAngle: number;
  aEndAngle: number;
  aClockwise: boolean;
  aRotation: number;

  constructor(
    aX = 0,
    aY = 0,
    xRadius = 1,
    yRadius = 1,
    aStartAngle = 0,
    aEndAngle = Math.PI * 2,
    aClockwise = false,
    aRotation = 0,
  ) {
    super();

    this.aX = aX;
    this.aY = aY;

    this.xRadius = xRadius;
    this.yRadius = yRadius;

    this.aStartAngle = aStartAngle;
    this.aEndAngle = aEndAngle;

    this.aClockwise = aClockwise;

    this.aRotation = aRotation;
  }

  getPoint(t: number, optionalTarget = vec2.create()) {
    const point = optionalTarget;

    const twoPi = Math.PI * 2;
    let deltaAngle = this.aEndAngle - this.aStartAngle;
    const samePoints = Math.abs(deltaAngle) < Number.EPSILON;

    // ensures that deltaAngle is 0 .. 2 PI
    while (deltaAngle < 0) deltaAngle += twoPi;
    while (deltaAngle > twoPi) deltaAngle -= twoPi;

    if (deltaAngle < Number.EPSILON) {
      if (samePoints) {
        deltaAngle = 0;
      } else {
        deltaAngle = twoPi;
      }
    }

    if (this.aClockwise === true && !samePoints) {
      if (deltaAngle === twoPi) {
        deltaAngle = -twoPi;
      } else {
        deltaAngle = deltaAngle - twoPi;
      }
    }

    const angle = this.aStartAngle + t * deltaAngle;
    let x = this.aX + this.xRadius * Math.cos(angle);
    let y = this.aY + this.yRadius * Math.sin(angle);

    if (this.aRotation !== 0) {
      const cos = Math.cos(this.aRotation);
      const sin = Math.sin(this.aRotation);

      const tx = x - this.aX;
      const ty = y - this.aY;

      // Rotate the point about the center of the ellipse.
      x = tx * cos - ty * sin + this.aX;
      y = tx * sin + ty * cos + this.aY;
    }

    return vec2.set(point, x, y);
  }
}
