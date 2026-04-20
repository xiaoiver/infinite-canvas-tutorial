/**
 * Liquid glass lens (superellipse SDF + {@link https://github.com/OverShifted/LiquidGlass/blob/master/assets/shaders/BatchRenderer2D.glsl OverShifted LiquidGlass}).
 * Fullscreen post-process: outside the lens mask samples the input unchanged; inside uses refracted UV + grain + rim glow.
 * `u_LG3.xy` is lens center in the same space as `v_Uv` (0–1). Refraction must add {@link https://github.com/OverShifted/LiquidGlass/blob/master/assets/shaders/BatchRenderer2D.glsl `v_MidPoint`}-style NDC offset: `targetNDC = sampleP * scale + (center * 2 - 1)`.
 * `u_LG4.zw` = per-axis ellipse size factors: `pShape = p / ellipseSize` before `sdSuperellipse` (larger → wider/taller lens on that axis).
 *
 * Uniforms: {@link liquidGlassUniformValues} → `u_LG0`–`u_LG4`.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_LG0;
  vec4 u_LG1;
  vec4 u_LG2;
  vec4 u_LG3;
  vec4 u_LG4;
};

out vec4 outputColor;

#define M_E 2.718281828459045

float sdSuperellipse(vec2 p, float n, float r) {
  vec2 p_abs = abs(p);
  float numerator = pow(p_abs.x, n) + pow(p_abs.y, n) - pow(r, n);
  float den_x = pow(p_abs.x, 2.0 * n - 2.0);
  float den_y = pow(p_abs.y, 2.0 * n - 2.0);
  float denominator = n * sqrt(den_x + den_y) + 0.00001;
  return numerator / denominator;
}

float fLens(float x, vec4 abcd) {
  float a = abcd.x;
  float b = abcd.y;
  float c = abcd.z;
  float d = abcd.w;
  return 1.0 - b * pow(c * M_E, -d * x - a);
}

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float glowAngular(vec2 uv) {
  return sin(atan(uv.y * 2.0 - 1.0, uv.x * 2.0 - 1.0) - 0.5);
}

void main(void) {
  vec2 center = u_LG3.xy;
  vec2 scaleNDC = u_LG3.zw;
  float aspect = max(u_LG1.w, 0.0001);

  vec2 p = (v_Uv - center) * 2.0;
  p.x *= aspect;

  vec2 ellipseSize = max(u_LG4.zw, vec2(1e-4));
  vec2 pShape = p / ellipseSize;

  float powerN = max(u_LG0.x, 1.0);
  float d = sdSuperellipse(pShape, powerN, 1.0);

  if (d > 0.0) {
    outputColor = texture(SAMPLER_2D(u_Texture), v_Uv);
    return;
  }

  float dist = -d;
  float fPow = max(u_LG0.y, 0.0001);
  vec2 sampleP = pShape * pow(fLens(dist, u_LG2), fPow);
  // Match reference: targetNDC = sampleP * scale + v_MidPoint (quad center in NDC). Fullscreen UV center (0.5,0.5) → NDC 0.
  vec2 lensCenterNdc = center * 2.0 - vec2(1.0);
  vec2 targetNDC = sampleP * scaleNDC + lensCenterNdc;
  vec2 coord = targetNDC * 0.5 + vec2(0.5);
  coord = clamp(coord, vec2(0.001), vec2(0.999));

  vec2 noiseSeed = v_Uv * max(u_LG4.xy, vec2(1.0));
  vec4 grain = vec4(vec3(rand(noiseSeed) - 0.5), 0.0);
  float noiseAmt = u_LG0.z;

  vec4 color = texture(SAMPLER_2D(u_Texture), coord);
  color.rgb += grain.rgb * noiseAmt;

  float gb = u_LG1.x;
  float ge0 = u_LG1.y;
  float ge1 = u_LG1.z;
  float gw = u_LG0.w;
  // Reference uses glowEdge0=0.06, glowEdge1=0 (reversed); avoid undefined smoothstep(edge0>=edge1).
  float glowBand =
    ge0 < ge1
      ? smoothstep(ge0, ge1, dist)
      : 1.0 - smoothstep(ge1, ge0, dist);
  float mul = glowAngular(v_Uv) * gw * glowBand + 1.0 + gb;
  outputColor = vec4(color.rgb * mul, color.a);
}
`;
