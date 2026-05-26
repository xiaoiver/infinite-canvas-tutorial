import { bigTriangleVert } from '../shaders/big-triangle';

export { bigTriangleVert as vert };

export const uniformBlock = `
layout(std140) uniform FillLayerComposeUniforms {
  vec4 u_BlendParams;
};
`;

export const fragBlitFirstLayer = /* wgsl */ `
${uniformBlock}
uniform sampler2D u_Src;
in vec2 v_Uv;
out vec4 outputColor;

void main() {
  vec4 s = texture(SAMPLER_2D(u_Src), v_Uv);
  float op = u_BlendParams.y;
  outputColor = vec4(s.rgb * op, s.a * op);
}
`;

export const fragBlendLayer = /* wgsl */ `
${uniformBlock}
uniform sampler2D u_Backdrop;
uniform sampler2D u_Src;
in vec2 v_Uv;
out vec4 outputColor;

const float EPS = 1e-5;

vec3 rgb2hsl(vec3 c) {
  float maxc = max(max(c.r, c.g), c.b);
  float minc = min(min(c.r, c.g), c.b);
  float l = (maxc + minc) * 0.5;
  float s = 0.0;
  float h = 0.0;
  float d = maxc - minc;
  if (d > EPS) {
    s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);
    if (maxc == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxc == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  if (s < EPS) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hue2rgb(p, q, h + 1.0 / 3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0 / 3.0)
  );
}

vec3 clip_color(vec3 c) {
  float l = dot(c, vec3(1.0));
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
  if (mode == 3) return Cb + Cs - 1.0;
  if (mode == 4) return vec3(1.0) - min(vec3(1.0), (vec3(1.0) - Cb) / max(Cs, vec3(EPS)));
  if (mode == 5) return max(Cb, Cs);
  if (mode == 6) return vec3(1.0) - (vec3(1.0) - Cb) * (vec3(1.0) - Cs);
  if (mode == 7) return min(vec3(1.0), Cb + Cs);
  if (mode == 8) return min(vec3(1.0), Cb / max(vec3(1.0) - Cs, vec3(EPS)));
  if (mode == 9) {
    vec3 r;
    r.r = Cb.r < 0.5 ? (2.0 * Cb.r * Cs.r) : (1.0 - 2.0 * (1.0 - Cb.r) * (1.0 - Cs.r));
    r.g = Cb.g < 0.5 ? (2.0 * Cb.g * Cs.g) : (1.0 - 2.0 * (1.0 - Cb.g) * (1.0 - Cs.g));
    r.b = Cb.b < 0.5 ? (2.0 * Cb.b * Cs.b) : (1.0 - 2.0 * (1.0 - Cb.b) * (1.0 - Cs.b));
    return r;
  }
  if (mode == 10) {
    vec3 one = vec3(1.0);
    return (one - Cs) * Cb * Cb + Cs * (one - (one - Cb) * (one - Cb));
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
  vec3 sh = rgb2hsl(Cs);
  vec3 bh = rgb2hsl(Cb);
  if (mode == 14) return hsl2rgb(vec3(sh.x, bh.y, bh.z));
  if (mode == 15) return set_lum(set_sat(Cs, bh.y), dot(Cb, vec3(0.3, 0.59, 0.11)));
  if (mode == 16) return hsl2rgb(vec3(sh.x, sh.y, bh.z));
  if (mode == 17) return set_lum(Cs, dot(Cb, vec3(0.3, 0.59, 0.11)));
  return Cs;
}

void main() {
  vec4 bp = texture(SAMPLER_2D(u_Backdrop), v_Uv);
  vec4 sp = texture(SAMPLER_2D(u_Src), v_Uv);
  float op = u_BlendParams.y;
  sp = vec4(sp.rgb * op, sp.a * op);
  float ab = bp.a;
  float as = sp.a;
  vec3 Cb = ab > EPS ? bp.rgb / ab : vec3(0.0);
  vec3 Cs = as > EPS ? sp.rgb / as : vec3(0.0);
  int mode = int(u_BlendParams.x + 0.5);
  vec3 Bmix = blend_mode_rgb(Cb, Cs, mode);
  vec3 outP = as * Bmix + bp.rgb * (1.0 - as);
  float ao = as + ab * (1.0 - as);
  outputColor = vec4(outP, ao);
}
`;
