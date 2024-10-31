import { mat3 } from 'gl-matrix';

const PADDING = 0;
/**
 * Since we use std140 layout for UniformBlock, padding needs to be added to mat3.
 */
export function paddingMat3(matrix: mat3) {
  return [
    matrix[0],
    matrix[1],
    matrix[2],
    PADDING,
    matrix[3],
    matrix[4],
    matrix[5],
    PADDING,
    matrix[6],
    matrix[7],
    matrix[8],
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
