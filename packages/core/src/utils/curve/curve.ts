import { vec2 } from 'gl-matrix';

/**
 * @see https://github.com/mrdoob/three.js/blob/dev/src/extras/core/Curve.js
 */
export abstract class Curve {
  type = 'Curve';
  arcLengthDivisions = 200;

  protected needsUpdate = true;
  protected cacheArcLengths: number[];

  abstract getPoint(t: number, optionalTarget?: any): vec2;

  getPointAt(u: number, optionalTarget?: any) {
    const t = this.getUtoTmapping(u);
    return this.getPoint(t, optionalTarget);
  }

  getPoints(divisions = 5) {
    const points: vec2[] = [];

    for (let d = 0; d <= divisions; d++) {
      points.push(this.getPoint(d / divisions));
    }

    return points;
  }

  getSpacedPoints(divisions = 5) {
    const points = [];

    for (let d = 0; d <= divisions; d++) {
      points.push(this.getPointAt(d / divisions));
    }

    return points;
  }

  getLength() {
    const lengths = this.getLengths();
    return lengths[lengths.length - 1];
  }

  getLengths(divisions = this.arcLengthDivisions) {
    if (
      this.cacheArcLengths &&
      this.cacheArcLengths.length === divisions + 1 &&
      !this.needsUpdate
    ) {
      return this.cacheArcLengths;
    }

    this.needsUpdate = false;

    const cache: number[] = [];
    let current: vec2,
      last = this.getPoint(0);
    let sum = 0;

    cache.push(0);

    for (let p = 1; p <= divisions; p++) {
      current = this.getPoint(p / divisions);
      sum += vec2.distance(current, last);
      cache.push(sum);
      last = current;
    }

    this.cacheArcLengths = cache;

    return cache; // { sums: cache, sum: sum }; Sum is in the last element.
  }

  updateArcLengths() {
    this.needsUpdate = true;
    this.getLengths();
  }

  // Given u ( 0 .. 1 ), get a t to find p. This gives you points which are equidistant
  getUtoTmapping(u: number, distance?: number) {
    const arcLengths = this.getLengths();

    let i = 0;
    const il = arcLengths.length;

    let targetArcLength; // The targeted u distance value to get

    if (distance) {
      targetArcLength = distance;
    } else {
      targetArcLength = u * arcLengths[il - 1];
    }

    // binary search for the index with largest value smaller than target u distance

    let low = 0,
      high = il - 1,
      comparison;

    while (low <= high) {
      i = Math.floor(low + (high - low) / 2); // less likely to overflow, though probably not issue here, JS doesn't really have integers, all numbers are floats

      comparison = arcLengths[i] - targetArcLength;

      if (comparison < 0) {
        low = i + 1;
      } else if (comparison > 0) {
        high = i - 1;
      } else {
        high = i;
        break;

        // DONE
      }
    }

    i = high;

    if (arcLengths[i] === targetArcLength) {
      return i / (il - 1);
    }

    // we could get finer grain at lengths, or use simple interpolation between two points

    const lengthBefore = arcLengths[i];
    const lengthAfter = arcLengths[i + 1];

    const segmentLength = lengthAfter - lengthBefore;

    // determine where we are between the 'before' and 'after' points

    const segmentFraction = (targetArcLength - lengthBefore) / segmentLength;

    // add that fractional amount to t

    const t = (i + segmentFraction) / (il - 1);

    return t;
  }

  // Returns a unit vector tangent at t
  // In case any sub curve does not implement its tangent derivation,
  // 2 points a small delta apart will be used to find its gradient
  // which seems to give a reasonable approximation
  // getTangent(t, optionalTarget) {
  //   const delta = 0.0001;
  //   let t1 = t - delta;
  //   let t2 = t + delta;

  //   // Capping in case of danger

  //   if (t1 < 0) t1 = 0;
  //   if (t2 > 1) t2 = 1;

  //   const pt1 = this.getPoint(t1);
  //   const pt2 = this.getPoint(t2);

  //   const tangent =
  //     optionalTarget || (pt1.isVector2 ? new Vector2() : new Vector3());

  //   tangent.copy(pt2).sub(pt1).normalize();

  //   return tangent;
  // }

  // getTangentAt(u, optionalTarget) {
  //   const t = this.getUtoTmapping(u);
  //   return this.getTangent(t, optionalTarget);
  // }

  // computeFrenetFrames(segments, closed: boolean) {
  //   // see http://www.cs.indiana.edu/pub/techreports/TR425.pdf

  //   const normal = vec2.create();

  //   const tangents = [];
  //   const normals = [];
  //   const binormals = [];

  //   const vec = vec2.create();
  //   const mat = mat3.create();

  //   // compute the tangent vectors for each segment on the curve

  //   for (let i = 0; i <= segments; i++) {
  //     const u = i / segments;

  //     tangents[i] = this.getTangentAt(u, new Vector3());
  //   }

  //   // select an initial normal vector perpendicular to the first tangent vector,
  //   // and in the direction of the minimum tangent xyz component

  //   normals[0] = vec2.create();
  //   binormals[0] = vec2.create();
  //   let min = Number.MAX_VALUE;
  //   const tx = Math.abs(tangents[0].x);
  //   const ty = Math.abs(tangents[0].y);

  //   if (tx <= min) {
  //     min = tx;
  //     vec2.set(normal, 1, 0);
  //   }

  //   if (ty <= min) {
  //     min = ty;
  //     vec2.set(normal, 0, 1);
  //   }

  //   vec.crossVectors(tangents[0], normal).normalize();

  //   normals[0].crossVectors(tangents[0], vec);
  //   binormals[0].crossVectors(tangents[0], normals[0]);

  //   // compute the slowly-varying normal and binormal vectors for each segment on the curve

  //   for (let i = 1; i <= segments; i++) {
  //     normals[i] = normals[i - 1].clone();

  //     binormals[i] = binormals[i - 1].clone();

  //     vec.crossVectors(tangents[i - 1], tangents[i]);

  //     if (vec.length() > Number.EPSILON) {
  //       vec.normalize();

  //       const theta = Math.acos(
  //         MathUtils.clamp(tangents[i - 1].dot(tangents[i]), -1, 1),
  //       ); // clamp for floating pt errors

  //       normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
  //     }

  //     binormals[i].crossVectors(tangents[i], normals[i]);
  //   }

  //   // if the curve is closed, postprocess the vectors so the first and last normal vectors are the same

  //   if (closed === true) {
  //     let theta = Math.acos(
  //       MathUtils.clamp(normals[0].dot(normals[segments]), -1, 1),
  //     );
  //     theta /= segments;

  //     if (
  //       tangents[0].dot(vec.crossVectors(normals[0], normals[segments])) > 0
  //     ) {
  //       theta = -theta;
  //     }

  //     for (let i = 1; i <= segments; i++) {
  //       // twist a little...
  //       normals[i].applyMatrix4(mat.makeRotationAxis(tangents[i], theta * i));
  //       binormals[i].crossVectors(tangents[i], normals[i]);
  //     }
  //   }

  //   return {
  //     tangents: tangents,
  //     normals: normals,
  //     binormals: binormals,
  //   };
  // }

  clone() {
    // @ts-ignore
    return new this.constructor().copy(this);
  }

  copy(source: Curve) {
    this.arcLengthDivisions = source.arcLengthDivisions;
    return this;
  }
}
