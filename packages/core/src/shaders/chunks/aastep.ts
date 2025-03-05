// @see https://github.com/glslify/glsl-aastep/blob/master/index.glsl
export const aastep = /* wgsl */ `
  float aastep(float threshold, float value) {
    float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
    return smoothstep(threshold - afwidth, threshold + afwidth, value);
  }
`;
