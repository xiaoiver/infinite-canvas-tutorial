import { vec2 } from 'gl-matrix';
import { CurvePath } from './curve-path';
import { LineCurve } from './line-curve';
import { QuadraticBezierCurve } from './quadratic-bezier-curve';
import { CubicBezierCurve } from './cubic-bezier-curve';
import { EllipseCurve } from './ellipse-curve';

export class Path extends CurvePath {
  currentPoint: vec2;

  constructor(points?: vec2[]) {
    super();

    this.currentPoint = vec2.create();

    if (points) {
      this.setFromPoints(points);
    }
  }

  setFromPoints(points: vec2[]) {
    this.moveTo(points[0][0], points[0][1]);

    for (let i = 1, l = points.length; i < l; i++) {
      this.lineTo(points[i][0], points[i][1]);
    }

    return this;
  }

  moveTo(x: number, y: number) {
    vec2.set(this.currentPoint, x, y); // TODO consider referencing vectors instead of copying?

    return this;
  }

  lineTo(x: number, y: number) {
    const curve = new LineCurve(
      vec2.clone(this.currentPoint),
      vec2.fromValues(x, y),
    );
    this.curves.push(curve);

    vec2.set(this.currentPoint, x, y);

    return this;
  }

  quadraticCurveTo(aCPx: number, aCPy: number, aX: number, aY: number) {
    const curve = new QuadraticBezierCurve(
      vec2.clone(this.currentPoint),
      vec2.fromValues(aCPx, aCPy),
      vec2.fromValues(aX, aY),
    );

    this.curves.push(curve);

    vec2.set(this.currentPoint, aX, aY);

    return this;
  }

  bezierCurveTo(
    aCP1x: number,
    aCP1y: number,
    aCP2x: number,
    aCP2y: number,
    aX: number,
    aY: number,
  ) {
    const curve = new CubicBezierCurve(
      vec2.clone(this.currentPoint),
      vec2.fromValues(aCP1x, aCP1y),
      vec2.fromValues(aCP2x, aCP2y),
      vec2.fromValues(aX, aY),
    );

    this.curves.push(curve);

    vec2.set(this.currentPoint, aX, aY);

    return this;
  }

  arc(
    aX: number,
    aY: number,
    aRadius: number,
    aStartAngle: number,
    aEndAngle: number,
    aClockwise: boolean,
  ) {
    const [x0, y0] = this.currentPoint;

    this.absarc(aX + x0, aY + y0, aRadius, aStartAngle, aEndAngle, aClockwise);

    return this;
  }

  absarc(
    aX: number,
    aY: number,
    aRadius: number,
    aStartAngle: number,
    aEndAngle: number,
    aClockwise: boolean,
  ) {
    this.absellipse(
      aX,
      aY,
      aRadius,
      aRadius,
      aStartAngle,
      aEndAngle,
      aClockwise,
    );

    return this;
  }

  absellipse(
    aX: number,
    aY: number,
    xRadius: number,
    yRadius: number,
    aStartAngle: number,
    aEndAngle: number,
    aClockwise: boolean,
    aRotation?: number,
  ) {
    const curve = new EllipseCurve(
      aX,
      aY,
      xRadius,
      yRadius,
      aStartAngle,
      aEndAngle,
      aClockwise,
      aRotation,
    );

    if (this.curves.length > 0) {
      // if a previous curve is present, attempt to join
      const firstPoint = curve.getPoint(0);

      if (!vec2.equals(firstPoint, this.currentPoint)) {
        this.lineTo(firstPoint[0], firstPoint[1]);
      }
    }

    this.curves.push(curve);

    const lastPoint = curve.getPoint(1);
    vec2.copy(this.currentPoint, lastPoint);

    return this;
  }
}
