import { TypedArray } from '@antv/g-device-api';

export function fractionate(val: number, minVal: number, maxVal: number) {
  return (val - minVal) / (maxVal - minVal);
}

export function modulate(
  val: number,
  minVal: number,
  maxVal: number,
  outMin: number,
  outMax: number,
) {
  const fr = fractionate(val, minVal, maxVal);
  const delta = outMax - outMin;
  return outMin + fr * delta;
}

export function avg(arr: number[] | TypedArray) {
  // @ts-ignore
  const total = arr.reduce(function (sum, b) {
    return sum + b;
  });
  return total / arr.length;
}

export function max(arr: number[] | TypedArray) {
  // @ts-ignore
  return arr.reduce(function (a, b) {
    return Math.max(a, b);
  });
}

export function normalize(out: number[], a: number[]) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var len = x * x + y * y + z * z;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
  }

  out[0] = a[0] * len;
  out[1] = a[1] * len;
  out[2] = a[2] * len;
  return out;
}