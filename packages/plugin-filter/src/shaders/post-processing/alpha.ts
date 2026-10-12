/**
 * Color adjustments operate on straight RGB. Shape paint textures are straight;
 * the full-canvas render graph supplies premultiplied RGBA. Keep each caller's
 * storage convention and clamp RGB before premultiplication, not after it.
 */
export const alpha = /* glsl */ `
vec4 filterStraightColor(vec4 color) {
  if (color.a <= 0.0) return vec4(0.0);
#ifndef FILTER_INPUT_STRAIGHT_ALPHA
  color.rgb /= color.a;
#endif
  return color;
}

vec4 filterOutputColor(vec4 color) {
  if (color.a <= 0.0) return vec4(0.0);
  color.rgb = clamp(color.rgb, 0.0, 1.0);
#ifndef FILTER_INPUT_STRAIGHT_ALPHA
  color.rgb *= color.a;
#endif
  return color;
}
`;
