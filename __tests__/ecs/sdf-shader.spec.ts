import { frag } from '../../packages/ecs/src/shaders/sdf';

describe('SDF shader antialiasing', () => {
  it('uses the signed distance derivative for shape edges', () => {
    expect(frag).toContain('float antialiasedBlur = -fwidth(distance);');
    expect(frag).not.toContain('fwidth(length(v_FragCoord))');
  });
});
