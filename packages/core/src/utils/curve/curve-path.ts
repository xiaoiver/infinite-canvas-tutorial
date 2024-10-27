import { vec2 } from 'gl-matrix';
import { Curve } from './curve';
import { LineCurve } from './line-curve';

/**
 * @see https://github.com/mrdoob/three.js/blob/dev/src/extras/core/CurvePath.js
 */
export class CurvePath extends Curve {
  curves: Curve[] = [];
  autoClose = false;

  cacheLengths: number[] = null;

  add(curve: Curve) {
    this.curves.push(curve);
  }

  closePath() {
    // Add a line curve if start and end of lines are not connected
    const startPoint = this.curves[0].getPoint(0);
    const endPoint = this.curves[this.curves.length - 1].getPoint(1);

    if (!vec2.equals(startPoint, endPoint)) {
      this.curves.push(new LineCurve(endPoint, startPoint));
    }

    return this;
  }

  // To get accurate point with reference to
  // entire path distance at time t,
  // following has to be done:

  // 1. Length of each sub path have to be known
  // 2. Locate and identify type of curve
  // 3. Get t for the curve
  // 4. Return curve.getPointAt(t')

  getPoint(t: number, optionalTarget) {
    const d = t * this.getLength();
    const curveLengths = this.getCurveLengths();
    let i = 0;

    // To think about boundaries points.

    while (i < curveLengths.length) {
      if (curveLengths[i] >= d) {
        const diff = curveLengths[i] - d;
        const curve = this.curves[i];

        const segmentLength = curve.getLength();
        const u = segmentLength === 0 ? 0 : 1 - diff / segmentLength;

        return curve.getPointAt(u, optionalTarget);
      }

      i++;
    }

    return null;

    // loop where sum != 0, sum > d , sum+1 <d
  }

  getLength() {
    const lens = this.getCurveLengths();
    return lens[lens.length - 1];
  }

  updateArcLengths() {
    this.needsUpdate = true;
    this.cacheLengths = null;
    this.getCurveLengths();
  }

  getCurveLengths() {
    // We use cache values if curves and cache array are same length

    if (this.cacheLengths && this.cacheLengths.length === this.curves.length) {
      return this.cacheLengths;
    }

    // Get length of sub-curve
    // Push sums into cached array

    const lengths = [];
    let sums = 0;

    for (let i = 0, l = this.curves.length; i < l; i++) {
      sums += this.curves[i].getLength();
      lengths.push(sums);
    }

    this.cacheLengths = lengths;

    return lengths;
  }

  getPoints(divisions = 12) {
    const points = [];
    let last: vec2;

    for (let i = 0, curves = this.curves; i < curves.length; i++) {
      const curve = curves[i];
      // @ts-ignore
      const resolution = curve.isEllipseCurve
        ? divisions * 2
        : curve.type === LineCurve.TYPE
        ? //  || curve.isLineCurve3
          1
        : // @ts-ignore
        curve.isSplineCurve
        ? // @ts-ignore
          divisions * curve.points.length
        : divisions;

      const pts = curve.getPoints(resolution);

      for (let j = 0; j < pts.length; j++) {
        const point = pts[j];

        if (last && vec2.equals(last, point)) continue; // ensures no consecutive points are duplicates

        points.push(point);
        last = point;
      }
    }

    if (
      this.autoClose &&
      points.length > 1 &&
      !points[points.length - 1].equals(points[0])
    ) {
      points.push(points[0]);
    }

    return points;
  }
}
