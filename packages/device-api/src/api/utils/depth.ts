import type { mat4 } from 'gl-matrix';
import { CompareFunction } from '../interfaces';

/**
 * @see https://forum.babylonjs.com/t/reverse-depth-buffer-z-buffer/6905/2
 */
export const IsDepthReversed = true;

export function reverseDepthForPerspectiveProjectionMatrix(
  m: mat4,
  isDepthReversed = IsDepthReversed,
): void {
  if (isDepthReversed) {
    m[10] = -m[10];
    m[14] = -m[14];
  }
}

export function reverseDepthForOrthographicProjectionMatrix(
  m: mat4,
  isDepthReversed = IsDepthReversed,
): void {
  if (isDepthReversed) {
    m[10] = -m[10];
    m[14] = -m[14] + 1;
  }
}

export function reverseDepthForCompareFunction(
  compareFunction: CompareFunction,
  isDepthReversed = IsDepthReversed,
): CompareFunction {
  if (isDepthReversed) {
    switch (compareFunction) {
      case CompareFunction.LESS:
        return CompareFunction.GREATER;
      case CompareFunction.LEQUAL:
        return CompareFunction.GEQUAL;
      case CompareFunction.GEQUAL:
        return CompareFunction.LEQUAL;
      case CompareFunction.GREATER:
        return CompareFunction.LESS;
      default:
        return compareFunction;
    }
  } else {
    return compareFunction;
  }
}

export function reverseDepthForClearValue(
  n: number,
  isDepthReversed = IsDepthReversed,
): number {
  if (isDepthReversed) {
    return 1.0 - n;
  } else {
    return n;
  }
}

export function reverseDepthForDepthOffset(
  n: number,
  isDepthReversed = IsDepthReversed,
): number {
  if (isDepthReversed) {
    return -n;
  } else {
    return n;
  }
}

export function compareDepthValues(
  a: number,
  b: number,
  op: CompareFunction,
  isDepthReversed = IsDepthReversed,
): boolean {
  op = reverseDepthForCompareFunction(op, isDepthReversed);
  if (op === CompareFunction.LESS) return a < b;
  else if (op === CompareFunction.LEQUAL) return a <= b;
  else if (op === CompareFunction.GREATER) return a > b;
  else if (op === CompareFunction.GEQUAL) return a >= b;
  else throw new Error('whoops');
}
