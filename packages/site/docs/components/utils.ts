import { isNumber } from '../../../core/src/utils';

export function paddingUniforms(
  uniforms: (number | number[] | Float32Array)[],
) {
  // calc buffer size
  let offset = 0;
  const uboBuffer: number[] = [];
  uniforms.forEach((value) => {
    // number | number[] | Float32Array
    if (
      isNumber(value) ||
      Array.isArray(value) ||
      value instanceof Float32Array
    ) {
      const array = isNumber(value) ? [value] : value;
      const formatByteSize = array.length > 4 ? 4 : array.length;

      // std140 UBO layout
      const emptySpace = 4 - (offset % 4);
      if (emptySpace !== 4) {
        if (emptySpace >= formatByteSize) {
        } else {
          offset += emptySpace;
          for (let j = 0; j < emptySpace; j++) {
            uboBuffer.push(0); // padding
          }
        }
      }

      offset += array.length;

      uboBuffer.push(...array);
    }
  });

  // padding
  const emptySpace = 4 - (uboBuffer.length % 4);
  if (emptySpace !== 4) {
    for (let j = 0; j < emptySpace; j++) {
      uboBuffer.push(0);
    }
  }
  return uboBuffer;
}
