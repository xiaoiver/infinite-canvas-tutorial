import { float32ToFloat16Bits } from '../../packages/ecs/src/utils/float32-to-float16-bits';

describe('float32ToFloat16Bits', () => {
  it('maps 1.0 to IEEE half 0x3c00', () => {
    expect(float32ToFloat16Bits(1)).toBe(0x3c00);
  });

  it('maps -2.0 to a negative half', () => {
    expect(float32ToFloat16Bits(-2)).toBe(0xc000);
  });
});
