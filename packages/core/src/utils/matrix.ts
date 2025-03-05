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

export function formatTransform(transform: string) {
  return transform;
  // @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/patternTransform
  // should remove unit: rotate(20deg) -> rotate(20)
  // return parseTransform(transform)
  //   .map((parsed) => {
  //     const { t, d } = parsed;
  //     if (t === 'translate') {
  //       return `translate(${d[0].value} ${d[1].value})`;
  //     }
  //     if (t === 'translateX') {
  //       return `translate(${d[0].value} 0)`;
  //     }
  //     if (t === 'translateY') {
  //       return `translate(0 ${d[0].value})`;
  //     }
  //     if (t === 'rotate') {
  //       return `rotate(${d[0].value})`;
  //     }
  //     if (t === 'scale') {
  //       // scale(1) scale(1, 1)
  //       const newScale = d?.map((s) => s.value) || [1, 1];
  //       return `scale(${newScale[0]}, ${newScale[1]})`;
  //     }
  //     if (t === 'scaleX') {
  //       const newScale = d?.map((s) => s.value) || [1];
  //       return `scale(${newScale[0]}, 1)`;
  //     }
  //     if (t === 'scaleY') {
  //       const newScale = d?.map((s) => s.value) || [1];
  //       return `scale(1, ${newScale[0]})`;
  //     }
  //     if (t === 'skew') {
  //       const newSkew = d?.map((s) => s.value) || [0, 0];
  //       return `skewX(${newSkew[0]}) skewY(${newSkew[1]})`;
  //     }
  //     if (t === 'skewZ') {
  //       const newSkew = d?.map((s) => s.value) || [0];
  //       return `skewX(${newSkew[0]})`;
  //     }
  //     if (t === 'skewY') {
  //       const newSkew = d?.map((s) => s.value) || [0];
  //       return `skewY(${newSkew[0]})`;
  //     }
  //     if (t === 'matrix') {
  //       const [a, b, c, dd, tx, ty] = d.map((s) => s.value);
  //       return `matrix(${a} ${b} ${c} ${dd} ${tx} ${ty})`;
  //     }

  //     return null;
  //   })
  //   .filter((item) => item !== null)
  //   .join(' ');
}
