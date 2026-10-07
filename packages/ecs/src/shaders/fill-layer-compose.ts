import { bigTriangleVert } from '../shaders/big-triangle';

// WebGL1 requires matching varying precision in both shader stages.
export const vert = `precision highp float;\n${bigTriangleVert}`;

export const uniformBlock = `
layout(std140) uniform FillLayerComposeUniforms {
  vec4 u_BlendParams;
};
`;

export const fragBlitFirstLayer = /* wgsl */ `
precision highp float;
${uniformBlock}
uniform sampler2D u_Src;
in vec2 v_Uv;
out vec4 outputColor;

void main() {
  vec4 s = texture(SAMPLER_2D(u_Src), v_Uv);
  float op = u_BlendParams.y;
  // Uploaded fill textures contain straight RGBA. Keep the accumulator premultiplied.
  outputColor = vec4(s.rgb * s.a * op, s.a * op);
}
`;

export const fragBlendLayer = /* wgsl */ `
precision highp float;
${uniformBlock}
uniform sampler2D u_Backdrop;
uniform sampler2D u_Src;
in vec2 v_Uv;
out vec4 outputColor;

const float EPS = 1e-5;

// W3C Compositing and Blending Level 1, section 10.
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
float sat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
float soft_light(float b, float s) {
  if (s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return b + (2.0 * s - 1.0) * (d - b);
}
float color_burn(float b, float s) {
  if (b >= 1.0) return 1.0;
  if (s <= 0.0) return 0.0;
  return 1.0 - min(1.0, (1.0 - b) / s);
}
float color_dodge(float b, float s) {
  if (b <= 0.0) return 0.0;
  if (s >= 1.0) return 1.0;
  return min(1.0, b / (1.0 - s));
}

vec3 clip_color(vec3 c) {
  float l = lum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + ((c - l) * l) / max(l - n, EPS);
  if (x > 1.0) c = l + ((c - l) * (1.0 - l)) / max(x - l, EPS);
  return clamp(c, 0.0, 1.0);
}

vec3 set_lum(vec3 c, float l2) {
  float d = l2 - dot(c, vec3(0.3, 0.59, 0.11));
  return clip_color(c + d);
}

vec3 set_sat(vec3 c, float s2) {
  float maxc = max(max(c.r, c.g), c.b);
  float minc = min(min(c.r, c.g), c.b);
  float sat = maxc - minc;
  if (sat < EPS) return vec3(0.0);
  return (c - minc) * s2 / sat;
}

vec3 blend_mode_rgb(vec3 Cb, vec3 Cs, int mode) {
  if (mode == 0) return Cs;
  if (mode == 1) return min(Cb, Cs);
  if (mode == 2) return Cb * Cs;
  if (mode == 3) return max(vec3(0.0), Cb + Cs - 1.0);
  if (mode == 4) return vec3(color_burn(Cb.r, Cs.r), color_burn(Cb.g, Cs.g), color_burn(Cb.b, Cs.b));
  if (mode == 5) return max(Cb, Cs);
  if (mode == 6) return vec3(1.0) - (vec3(1.0) - Cb) * (vec3(1.0) - Cs);
  if (mode == 7) return min(vec3(1.0), Cb + Cs);
  if (mode == 8) return vec3(color_dodge(Cb.r, Cs.r), color_dodge(Cb.g, Cs.g), color_dodge(Cb.b, Cs.b));
  if (mode == 9) {
    vec3 r;
    r.r = Cb.r < 0.5 ? (2.0 * Cb.r * Cs.r) : (1.0 - 2.0 * (1.0 - Cb.r) * (1.0 - Cs.r));
    r.g = Cb.g < 0.5 ? (2.0 * Cb.g * Cs.g) : (1.0 - 2.0 * (1.0 - Cb.g) * (1.0 - Cs.g));
    r.b = Cb.b < 0.5 ? (2.0 * Cb.b * Cs.b) : (1.0 - 2.0 * (1.0 - Cb.b) * (1.0 - Cs.b));
    return r;
  }
  if (mode == 10) {
    return vec3(soft_light(Cb.r, Cs.r), soft_light(Cb.g, Cs.g), soft_light(Cb.b, Cs.b));
  }
  if (mode == 11) {
    vec3 r;
    r.r = Cs.r < 0.5 ? (2.0 * Cb.r * Cs.r) : (1.0 - 2.0 * (1.0 - Cb.r) * (1.0 - Cs.r));
    r.g = Cs.g < 0.5 ? (2.0 * Cb.g * Cs.g) : (1.0 - 2.0 * (1.0 - Cb.g) * (1.0 - Cs.g));
    r.b = Cs.b < 0.5 ? (2.0 * Cb.b * Cs.b) : (1.0 - 2.0 * (1.0 - Cb.b) * (1.0 - Cs.b));
    return r;
  }
  if (mode == 12) return abs(Cb - Cs);
  if (mode == 13) return Cb + Cs - 2.0 * Cb * Cs;
  if (mode == 14) return set_lum(set_sat(Cs, sat(Cb)), lum(Cb));
  if (mode == 15) return set_lum(set_sat(Cb, sat(Cs)), lum(Cb));
  if (mode == 16) return set_lum(Cs, lum(Cb));
  if (mode == 17) return set_lum(Cb, lum(Cs));
  return Cs;
}

void main() {
  vec4 bp = texture(SAMPLER_2D(u_Backdrop), v_Uv);
  vec4 sp = texture(SAMPLER_2D(u_Src), v_Uv);
  // Fill sources are straight; node render targets are already premultiplied.
  if (u_BlendParams.z > 0.5) sp.rgb *= sp.a;
  float op = u_BlendParams.y;
  sp = vec4(sp.rgb * op, sp.a * op);
  float ab = bp.a;
  float as = sp.a;
  vec3 Cb = ab > EPS ? bp.rgb / ab : vec3(0.0);
  vec3 Cs = as > EPS ? sp.rgb / as : vec3(0.0);
  int mode = int(u_BlendParams.x + 0.5);
  vec3 Bmix = blend_mode_rgb(Cb, Cs, mode);
  vec3 outP = (1.0 - ab) * sp.rgb + as * ab * Bmix + (1.0 - as) * bp.rgb;
  float ao = as + ab * (1.0 - as);
  // The final fill texture is sampled by the straight-alpha shape shader.
  if (u_BlendParams.w > 0.5) outP = ao > EPS ? outP / ao : vec3(0.0);
  outputColor = vec4(outP, ao);
}
`;
