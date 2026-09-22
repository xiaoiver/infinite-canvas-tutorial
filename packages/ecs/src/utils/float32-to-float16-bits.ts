/**
 * IEEE 754 binary32 → binary16 **uint16** bit pattern (GPU `rgba16float` texel channel).
 * Used for LUT atlas uploads; not endian-swapped beyond storing each channel as one `uint16`.
 */
export function float32ToFloat16Bits(value: number): number {
  const floatView = new Float32Array(1);
  const int32View = new Int32Array(floatView.buffer);
  floatView[0] = value;
  const x = int32View[0]!;

  const sign = (x >> 16) & 0x8000;
  const exponent = ((x >> 23) & 0xff) - 127 + 15;
  const mantissa = x & 0x007fffff;

  if ((x & 0x7f800000) === 0x7f800000) {
    if (x & 0x007fffff) {
      return sign | 0x7e00;
    }
    return sign | 0x7c00;
  }
  if ((x & 0x7f800000) === 0) {
    return sign;
  }
  if (exponent >= 31) {
    return sign | 0x7c00;
  }
  if (exponent <= 0) {
    if (exponent < -10) {
      return sign;
    }
    const m = mantissa | 0x00800000;
    const shift = 14 - exponent;
    let halfM = m >> shift;
    if (m & (1 << (shift - 1))) {
      halfM++;
    }
    return sign | halfM;
  }
  return sign | (exponent << 10) | (mantissa >> 13);
}
