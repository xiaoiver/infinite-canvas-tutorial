import { mat3, vec2, vec3, vec4 } from 'gl-matrix';

const isNumber = (a): a is number => typeof a === 'number';

export function createVec3(x: number | vec2 | vec3 | vec4, y = 0, z = 0) {
  if (Array.isArray(x) && x.length === 3) {
    return vec3.clone(x);
  }

  if (isNumber(x)) {
    return vec3.fromValues(x, y, z);
  }

  return vec3.fromValues(x[0], x[1] || y, x[2] || z);
}

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
