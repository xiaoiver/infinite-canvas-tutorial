import { Random } from 'roughjs/bin/math';
import { mat3, vec2 } from 'gl-matrix';

// @see https://stackoverflow.com/questions/22521982/check-if-point-is-inside-a-polygon
export function inside(point: [number, number], vs: [number, number][]) {
  // ray-casting algorithm based on
  // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html

  const x = point[0];
  const y = point[1];

  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

// export function rotateAroundPoint(
//   shape: OBB,
//   angleRad: number,
//   point: IPointData,
// ): OBB {
//   const width = shape.maxX - shape.minX;
//   const height = shape.maxY - shape.minY;
//   const x =
//     point.x +
//     (shape.minX - point.x) * Math.cos(angleRad) -
//     (shape.minY - point.y) * Math.sin(angleRad);
//   const y =
//     point.y +
//     (shape.minX - point.x) * Math.sin(angleRad) +
//     (shape.minY - point.y) * Math.cos(angleRad);

//   return new OBB(x, y, x + width, y + height, shape.rotation + angleRad);
// }

export function bisect(norm: vec2, norm2: vec2, dy: number) {
  const bisect = vec2.scale(
    vec2.create(),
    vec2.add(vec2.create(), norm, norm2),
    0.5,
  );
  vec2.scale(bisect, bisect, 1 / vec2.dot(norm, bisect));
  return vec2.scale(bisect, bisect, dy);
}

const random = new Random(Date.now());
export const randomInteger = () => Math.floor(random.next() * 2 ** 31);

// @see https://github.com/konvajs/konva/blob/master/src/Util.ts#L213
export function decompose(mat: mat3) {
  let row0x = mat[0];
  let row0y = mat[1];
  let row1x = mat[3];
  let row1y = mat[4];
  // decompose 3x3 matrix
  // @see https://www.w3.org/TR/css-transforms-1/#decomposing-a-2d-matrix
  let scalingX = Math.sqrt(row0x * row0x + row0y * row0y);
  let scalingY = Math.sqrt(row1x * row1x + row1y * row1y);

  // If determinant is negative, one axis was flipped.
  const determinant = row0x * row1y - row0y * row1x;
  if (determinant < 0) {
    // Flip axis with minimum unit vector dot product.
    if (row0x < row1y) {
      scalingX = -scalingX;
    } else {
      scalingY = -scalingY;
    }
  }

  // Renormalize matrix to remove scale.
  if (scalingX) {
    const invScalingX = 1 / scalingX;
    row0x *= invScalingX;
    row0y *= invScalingX;
  }
  if (scalingY) {
    const invScalingY = 1 / scalingY;
    row1x *= invScalingY;
    row1y *= invScalingY;
  }

  // Compute rotation and renormalize matrix.
  const rotation = Math.atan2(row0y, row0x);

  return {
    translation: [mat[6], mat[7]],
    scale: [scalingX, scalingY],
    rotation,
  };
}

export function snapToGrid(value: number, gridSize: number) {
  return Math.round(value / gridSize) * gridSize;
}

type InclusiveRange = [number, number];

/**
 * Given two ranges, return if the two ranges overlap with each other e.g.
 * [1, 3] overlaps with [2, 4] while [1, 3] does not overlap with [4, 5].
 *
 * @param param0 One of the ranges to compare
 * @param param1 The other range to compare against
 * @returns TRUE if the ranges overlap
 */
export const rangesOverlap = (
  [a0, a1]: InclusiveRange,
  [b0, b1]: InclusiveRange,
): boolean => {
  if (a0 <= b0) {
    return a1 >= b0;
  }

  if (a0 >= b0) {
    return b1 >= a0;
  }

  return false;
};

/**
 * Given two ranges,return ther intersection of the two ranges if any e.g. the
 * intersection of [1, 3] and [2, 4] is [2, 3].
 *
 * @param param0 The first range to compare
 * @param param1 The second range to compare
 * @returns The inclusive range intersection or NULL if no intersection
 */
export const rangeIntersection = (
  [a0, a1]: InclusiveRange,
  [b0, b1]: InclusiveRange,
): InclusiveRange | null => {
  const rangeStart = Math.max(a0, b0);
  const rangeEnd = Math.min(a1, b1);

  if (rangeStart <= rangeEnd) {
    return [rangeStart, rangeEnd] as InclusiveRange;
  }

  return null;
};
