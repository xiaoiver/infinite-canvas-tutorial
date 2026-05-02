import { parseEffect, formatFilter } from '../../packages/ecs/src/utils/filter';

describe('LUT filter parse / format', () => {
  it('parses named lut', () => {
    const e = parseEffect('lut(fuji, 0.5)');
    expect(e).toEqual([{ type: 'lut', lutKey: 'fuji', strength: 0.5 }]);
  });

  it('parses url() lut', () => {
    const e = parseEffect('lut(url("./a.cube"), 1)');
    expect(e).toEqual([{ type: 'lut', lutKey: './a.cube', strength: 1 }]);
  });

  it('parses name() lut', () => {
    const e = parseEffect('lut(name("my-grade"), 0.25)');
    expect(e).toEqual([{ type: 'lut', lutKey: 'my-grade', strength: 0.25 }]);
  });

  it('round-trips named lut via formatFilter', () => {
    const e = parseEffect('lut(fuji, 0.3)');
    expect(formatFilter(e)).toBe('lut(fuji, 0.3)');
  });
});
