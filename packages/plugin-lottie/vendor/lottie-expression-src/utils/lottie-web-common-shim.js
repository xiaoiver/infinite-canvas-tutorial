/**
 * Minimal subset of lottie-web `utils/common.js` for ExpressionManager only
 * (avoids navigator / DOM / project interface side effects).
 * @see https://github.com/airbnb/lottie-web/blob/master/player/js/utils/common.js
 */
import { createSizedArray } from './helpers/arrays.js';

const BMMath = {};
(function () {
  const propertyNames = [
    'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atanh', 'atan2', 'ceil', 'cbrt',
    'expm1', 'clz32', 'cos', 'cosh', 'exp', 'floor', 'fround', 'hypot', 'imul', 'log',
    'log1p', 'log2', 'log10', 'max', 'min', 'pow', 'random', 'round', 'sign', 'sin',
    'sinh', 'sqrt', 'tan', 'tanh', 'trunc', 'E', 'LN10', 'LN2', 'LOG10E', 'LOG2E',
    'PI', 'SQRT1_2', 'SQRT2',
  ];
  let i;
  const len = propertyNames.length;
  for (i = 0; i < len; i += 1) {
    BMMath[propertyNames[i]] = Math[propertyNames[i]];
  }
}());

BMMath.random = Math.random;
BMMath.abs = function (val) {
  const tOfVal = typeof val;
  if (tOfVal === 'object' && val.length) {
    const absArr = createSizedArray(val.length);
    let j;
    const len = val.length;
    for (j = 0; j < len; j += 1) {
      absArr[j] = Math.abs(val[j]);
    }
    return absArr;
  }
  return Math.abs(val);
};

export const degToRads = Math.PI / 180;
export { BMMath };
