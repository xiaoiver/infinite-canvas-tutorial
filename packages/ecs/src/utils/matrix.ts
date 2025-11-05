import { Mat3 } from '../components';

const PADDING = 0;
/**
 * Since we use std140 layout for UniformBlock, padding needs to be added to mat3.
 */
export function paddingMat3(matrix: Mat3) {
  return [
    matrix.m00,
    matrix.m01,
    matrix.m02,
    PADDING,
    matrix.m10,
    matrix.m11,
    matrix.m12,
    PADDING,
    matrix.m20,
    matrix.m21,
    matrix.m22,
    PADDING,
  ];
}

export function distanceBetweenPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  return distance;
}
