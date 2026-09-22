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

export function toDomPrecision(v: number) {
  return Math.round(v * 1e4) / 1e4;
}

export function isPointInEllipse(
  x: number,
  y: number,
  h: number,
  k: number,
  a: number,
  b: number,
) {
  // 计算点到椭圆中心的 x 和 y 坐标差
  const dx = x - h;
  const dy = y - k;

  // 计算点相对于椭圆中心的坐标平方，然后除以半轴长度的平方
  const squaredDistance = (dx * dx) / (a * a) + (dy * dy) / (b * b);

  // 如果计算结果小于或等于 1，则点在椭圆内
  return squaredDistance <= 1;
}

export function pointToLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
  y: number,
) {
  const d: [number, number] = [x2 - x1, y2 - y1];
  if (vec2.exactEquals(d, [0, 0])) {
    return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
  }
  const u: [number, number] = [-d[1], d[0]];
  vec2.normalize(u, u);
  const a: [number, number] = [x - x1, y - y1];
  return Math.abs(vec2.dot(a, u));
}

export function inLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineWidth: number,
  x: number,
  y: number,
) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const halfWidth = lineWidth / 2;
  // 因为目前的方案是计算点到直线的距离，而有可能会在延长线上，所以要先判断是否在包围盒内
  // 这种方案会在水平或者竖直的情况下载线的延长线上有半 lineWidth 的误差
  if (
    !(
      x >= minX - halfWidth &&
      x <= maxX + halfWidth &&
      y >= minY - halfWidth &&
      y <= maxY + halfWidth
    )
  ) {
    return false;
  }

  return pointToLine(x1, y1, x2, y2, x, y) <= lineWidth / 2;
}

export function inPolyline(
  points: [number, number][],
  lineWidth: number,
  x: number,
  y: number,
) {
  for (let i = 0; i < points.length - 1; i++) {
    const x1 = points[i][0];
    const y1 = points[i][1];
    const x2 = points[i + 1][0];
    const y2 = points[i + 1][1];

    if (inLine(x1, y1, x2, y2, lineWidth, x, y)) {
      return true;
    }
  }

  return false;
}