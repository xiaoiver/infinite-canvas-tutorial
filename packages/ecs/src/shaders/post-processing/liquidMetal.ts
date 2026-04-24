/**
 * Liquid metal: ported from
 * {@link https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/liquid-metal.ts paper-design/liquid-metal}.
 * Fullscreen post: `v_Uv` / `u_Texture` stand in for `v_imageUV` / `u_image` when `u_isImage>0.5`.
 * Edge/opacity is approximated from the scene texture (not Poisson R+G pre-pass).
 * Uniforms: {@link liquidMetalUniformValues} → `u_LM0`…`u_LM5` (6 × vec4).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_LM0;
  vec4 u_LM1;
  vec4 u_LM2;
  vec4 u_LM3;
  vec4 u_LM4;
  vec4 u_LM5;
};

out vec4 outputColor;

#define PI 3.14159265358979323846

vec2 rotateLm(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

vec3 permuteLm(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoiseLm(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permuteLm(permuteLm(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float getColorChangesLm(
  float c1, float c2, float stripe_p, vec3 w, float blur, float bump, float tint, float isImage) {

  float ch = mix(c2, c1, smoothstep(0.0, 2.0 * blur, stripe_p));
  float border = w[0];
  ch = mix(ch, c2, smoothstep(border, border + 2.0 * blur, stripe_p));
  if (isImage > 0.5) {
    bump = smoothstep(0.2, 0.8, bump);
  }
  border = w[0] + 0.4 * (1.0 - bump) * w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2.0 * blur, stripe_p));
  border = w[0] + 0.5 * (1.0 - bump) * w[1];
  ch = mix(ch, c2, smoothstep(border, border + 2.0 * blur, stripe_p));
  border = w[0] + w[1];
  ch = mix(ch, c1, smoothstep(border, border + 2.0 * blur, stripe_p));
  float gradient_t = (stripe_p - w[0] - w[1]) / max(w[2], 1e-4);
  float gradient = mix(c1, c2, smoothstep(0.0, 1.0, gradient_t));
  ch = mix(ch, gradient, smoothstep(border, border + 0.5 * blur, stripe_p));
  ch = mix(ch, 1.0 - min(1.0, (1.0 - ch) / max(tint, 0.0001)), u_LM2.a);
  return ch;
}

float getImgFrameLm(vec2 uv, float th) {
  float frame = 1.0;
  frame *= smoothstep(0.0, th, uv.y);
  frame *= 1.0 - smoothstep(1.0 - th, 1.0, uv.y);
  frame *= smoothstep(0.0, th, uv.x);
  frame *= 1.0 - smoothstep(1.0 - th, 1.0, uv.x);
  return frame;
}

float blurEdge3x3Lm(
  sampler2D tex, vec2 uv, vec2 dudx, vec2 dudy, float radius, float centerSample) {
  vec2 texel = 1.0 / max(u_LM0.xy, vec2(1.0));
  vec2 r = radius * texel;
  float w1 = 1.0, w2 = 2.0, w4 = 4.0;
  float norm = 16.0;
  float sum = w4 * centerSample;
  sum += w2 * textureGrad(SAMPLER_2D(tex), uv + vec2(0.0, -r.y), dudx, dudy).a;
  sum += w2 * textureGrad(SAMPLER_2D(tex), uv + vec2(0.0, r.y), dudx, dudy).a;
  sum += w2 * textureGrad(SAMPLER_2D(tex), uv + vec2(-r.x, 0.0), dudx, dudy).a;
  sum += w2 * textureGrad(SAMPLER_2D(tex), uv + vec2(r.x, 0.0), dudx, dudy).a;
  sum += w1 * textureGrad(SAMPLER_2D(tex), uv + vec2(-r.x, -r.y), dudx, dudy).a;
  sum += w1 * textureGrad(SAMPLER_2D(tex), uv + vec2(r.x, -r.y), dudx, dudy).a;
  sum += w1 * textureGrad(SAMPLER_2D(tex), uv + vec2(-r.x, r.y), dudx, dudy).a;
  sum += w1 * textureGrad(SAMPLER_2D(tex), uv + vec2(r.x, r.y), dudx, dudy).a;
  return sum / norm;
}

void main() {
  const float firstFrameOffset = 2.8;
  float uTime = u_LM0.z;
  float t = 0.3 * (uTime + firstFrameOffset);
  float u_repetition = u_LM3.x;
  float u_softness = u_LM3.y;
  float u_shiftRed = u_LM3.z;
  float u_shiftBlue = u_LM3.w;
  float u_distortion = u_LM4.x;
  float u_contour = u_LM4.y;
  float u_angle = u_LM4.z;
  float u_shape = u_LM4.w;
  float u_isImage = u_LM5.x;

  vec2 uv0 = v_Uv;
  vec2 dudx = dFdx(v_Uv);
  vec2 dudy = dFdy(v_Uv);
  vec4 img0 = textureGrad(SAMPLER_2D(u_Texture), v_Uv, dudx, dudy);

  vec2 uv;
  if (u_isImage > 0.5) {
    uv = v_Uv;
  } else {
    vec2 v_objectUV = v_Uv - 0.5;
    uv = v_objectUV + 0.5;
    uv.y = 1.0 - uv.y;
  }

  float cycleWidth = u_repetition;
  float edge = 0.0;

  vec2 rotatedUV = uv - 0.5;
  float angleA = (-u_angle + 70.0) * PI / 180.0;
  float cosA = cos(angleA);
  float sinA = sin(angleA);
  rotatedUV = vec2(
    rotatedUV.x * cosA - rotatedUV.y * sinA,
    rotatedUV.x * sinA + rotatedUV.y * cosA
  ) + 0.5;

  vec2 v_responsiveUV = v_Uv - 0.5;
  vec2 v_responsiveBoxGivenSize = u_LM0.xy;
  bool imageMode = u_isImage > 0.5;

  if (imageMode) {
    float edgeRaw = length(vec2(dFdx(img0.a), dFdy(img0.a)))
      * min(u_LM0.x, u_LM0.y) * 1.2;
    edgeRaw = min(edgeRaw, 1.0);
    edge = blurEdge3x3Lm(u_Texture, uv0, dudx, dudy, 6.0, edgeRaw);
    edge = pow(max(edge, 0.0), 1.6);
    edge *= mix(0.0, 1.0, smoothstep(0.0, 0.4, u_contour));
    uv = uv0;
  } else {
    if (u_shape < 1.0) {
      vec2 borderUV = v_responsiveUV + 0.5;
      float ratio = v_responsiveBoxGivenSize.x / max(v_responsiveBoxGivenSize.y, 1.0);
      vec2 mask0 = min(borderUV, 1.0 - borderUV);
      vec2 pixel_thickness = min(250.0 / v_responsiveBoxGivenSize, vec2(0.5));
      float maskX = smoothstep(0.0, pixel_thickness.x, mask0.x);
      float maskY = smoothstep(0.0, pixel_thickness.y, mask0.y);
      maskX = pow(maskX, 0.25);
      maskY = pow(maskY, 0.25);
      edge = clamp(1.0 - maskX * maskY, 0.0, 1.0);
      uv = v_responsiveUV;
      if (ratio > 1.0) {
        uv.y /= ratio;
      } else {
        uv.x *= ratio;
      }
      uv += 0.5;
      uv.y = 1.0 - uv.y;
      cycleWidth *= 2.0;
    } else if (u_shape < 2.0) {
      vec2 shapeUV = uv - 0.5;
      shapeUV *= 0.67;
      edge = pow(clamp(3.0 * length(shapeUV), 0.0, 1.0), 18.0);
    } else if (u_shape < 3.0) {
      vec2 shapeUV = uv - 0.5;
      shapeUV *= 1.68;
      float r = length(shapeUV) * 2.0;
      float a = atan(shapeUV.y, shapeUV.x) + 0.2;
      r *= (1.0 + 0.05 * sin(3.0 * a + 2.0 * t));
      float f = abs(cos(a * 3.0));
      edge = smoothstep(f, f + 0.7, r);
      edge *= edge;
      uv *= 0.8;
      cycleWidth *= 1.6;
    } else if (u_shape < 4.0) {
      vec2 shapeUV = uv - 0.5;
      shapeUV = rotateLm(shapeUV, 0.25 * PI);
      shapeUV *= 1.42;
      shapeUV += 0.5;
      vec2 mask0 = min(shapeUV, 1.0 - shapeUV);
      vec2 pixel_thickness2 = vec2(0.15);
      float maskX = smoothstep(0.0, pixel_thickness2.x, mask0.x);
      float maskY = smoothstep(0.0, pixel_thickness2.y, mask0.y);
      maskX = pow(maskX, 0.25);
      maskY = pow(maskY, 0.25);
      edge = clamp(1.0 - maskX * maskY, 0.0, 1.0);
    } else if (u_shape < 5.0) {
      vec2 shapeUV = uv - 0.5;
      shapeUV *= 1.3;
      edge = 0.0;
      for (int i = 0; i < 5; i++) {
        float fi = float(i);
        float sp = 1.5 + 2.0 / 3.0 * sin(fi * 12.345);
        float an = -fi * 1.5;
        vec2 dir1 = vec2(cos(an), sin(an));
        vec2 dir2 = vec2(cos(an + 1.57), sin(an + 1.57));
        vec2 traj = 0.4 * (dir1 * sin(t * sp + fi * 1.23) + dir2 * cos(t * (sp * 0.7) + fi * 2.17));
        float d = length(shapeUV + traj);
        edge += pow(1.0 - clamp(d, 0.0, 1.0), 4.0);
      }
      edge = 1.0 - smoothstep(0.65, 0.9, edge);
      edge = pow(edge, 4.0);
    }
    edge = mix(
      smoothstep(0.9 - 2.0 * fwidth(edge), 0.9, edge), edge, smoothstep(0.0, 0.4, u_contour)
    );
  }

  float opacity = 0.0;
  if (imageMode) {
    opacity = img0.a;
    float frame = getImgFrameLm(v_Uv, 0.0);
    opacity *= frame;
  } else {
    opacity = 1.0 - smoothstep(0.9 - 2.0 * fwidth(edge), 0.9, edge);
    if (u_shape < 2.0) {
      edge = 1.2 * edge;
    } else if (u_shape < 5.0) {
      edge = 1.8 * pow(edge, 1.5);
    }
  }

  float diagBLtoTR = rotatedUV.x - rotatedUV.y;
  float diagTLtoBR = rotatedUV.x + rotatedUV.y;

  vec3 color1 = vec3(0.98, 0.98, 1.0);
  vec3 color2 = vec3(0.1, 0.1, 0.1 + 0.1 * smoothstep(0.7, 1.3, diagTLtoBR));

  vec2 grad_uv = uv - 0.5;
  float distG = length(grad_uv + vec2(0.0, 0.2 * diagBLtoTR));
  grad_uv = rotateLm(grad_uv, (0.25 - 0.2 * diagBLtoTR) * PI);
  float direction = grad_uv.x;

  float bump = pow(1.8 * distG, 1.2);
  bump = 1.0 - bump;
  bump *= pow(uv.y, 0.3);

  float thin_strip_1_ratio = 0.12 / cycleWidth * (1.0 - 0.4 * bump);
  float thin_strip_2_ratio = 0.07 / cycleWidth * (1.0 + 0.4 * bump);
  float wide_strip_ratio = 1.0 - thin_strip_1_ratio - thin_strip_2_ratio;
  float thin_strip_1_width = cycleWidth * thin_strip_1_ratio;
  float thin_strip_2_width = cycleWidth * thin_strip_2_ratio;

  float nlm = snoiseLm(uv - t);
  edge += (1.0 - edge) * u_distortion * nlm;
  float contourLm = 0.0;

  direction += diagBLtoTR;
  direction -= 2.0 * nlm * diagBLtoTR * (smoothstep(0.0, 1.0, edge) * (1.0 - smoothstep(0.0, 1.0, edge)));
  direction *= mix(1.0, 1.0 - edge, smoothstep(0.5, 1.0, u_contour));
  direction -= 1.7 * edge * smoothstep(0.5, 1.0, u_contour);
  direction += 0.2 * pow(u_contour, 4.0) * (1.0 - smoothstep(0.0, 1.0, edge));
  bump *= clamp(pow(uv.y, 0.1), 0.3, 1.0);
  direction *= (0.1 + (1.0 - edge) * bump);
  direction *= (0.4 + 0.6 * (1.0 - smoothstep(0.5, 1.0, edge)));
  direction += 0.18 * (smoothstep(0.1, 0.2, uv.y) * (1.0 - smoothstep(0.2, 0.4, uv.y)));
  direction += 0.03 * (smoothstep(0.1, 0.2, 1.0 - uv.y) * (1.0 - smoothstep(0.2, 0.4, 1.0 - uv.y)));
  direction *= (0.5 + 0.5 * pow(uv.y, 2.0));
  direction *= cycleWidth;
  direction -= t;
  float colorDispersion = 1.0 - bump;
  colorDispersion = clamp(colorDispersion, 0.0, 1.0);
  float dispersionRed = colorDispersion;
  dispersionRed += 0.03 * bump * nlm;
  dispersionRed += 5.0
    * (smoothstep(-0.1, 0.2, uv.y) * (1.0 - smoothstep(0.1, 0.5, uv.y)))
    * (smoothstep(0.4, 0.6, bump) * (1.0 - smoothstep(0.4, 1.0, bump)));
  dispersionRed -= diagBLtoTR;
  float dispersionBlue = colorDispersion;
  dispersionBlue *= 1.3;
  dispersionBlue
    += (smoothstep(0.0, 0.4, uv.y) * (1.0 - smoothstep(0.1, 0.8, uv.y)))
    * (smoothstep(0.4, 0.6, bump) * (1.0 - smoothstep(0.4, 0.8, bump)));
  dispersionBlue -= 0.2 * edge;
  dispersionRed *= (u_shiftRed / 20.0);
  dispersionBlue *= (u_shiftBlue / 20.0);
  float blurV = 0.0;
  float rExtraBlur = 0.0;
  float gExtraBlur = 0.0;
  if (u_isImage > 0.5) {
    float softness = 0.05 * u_softness;
    blurV = softness
      + 0.5 * smoothstep(1.0, 10.0, u_repetition) * smoothstep(0.0, 1.0, edge);
    float smallCanvasT = 1.0 - smoothstep(100.0, 500.0, min(u_LM0.x, u_LM0.y));
    blurV += smallCanvasT * smoothstep(0.0, 1.0, edge);
    rExtraBlur = softness * (0.05 + 0.1 * (u_shiftRed / 20.0) * bump);
    gExtraBlur = softness * 0.05 / max(0.001, abs(1.0 - diagBLtoTR));
  } else {
    blurV = u_softness / 15.0 + 0.3 * contourLm;
  }

  vec3 w = vec3(thin_strip_1_width, thin_strip_2_width, wide_strip_ratio);
  w[1] -= 0.02 * smoothstep(0.0, 1.0, edge + bump);
  float stripe_r = fract(direction + dispersionRed);
  float isImgF = u_isImage;
  float rC = getColorChangesLm(
    color1.r, color2.r, stripe_r, w, blurV + fwidth(stripe_r) + rExtraBlur, bump, u_LM2.r, isImgF);
  float stripe_g = fract(direction);
  float gC = getColorChangesLm(
    color1.g, color2.g, stripe_g, w, blurV + fwidth(stripe_g) + gExtraBlur, bump, u_LM2.g, isImgF);
  float stripe_b = fract(direction - dispersionBlue);
  float bC = getColorChangesLm(
    color1.b, color2.b, stripe_b, w, blurV + fwidth(stripe_b), bump, u_LM2.b, isImgF);
  vec3 color = vec3(rC, gC, bC);
  color *= opacity;

  vec4 u_colorBack = u_LM1;
  vec3 bgColor = u_colorBack.rgb * u_colorBack.a;
  color = color + bgColor * (1.0 - opacity);
  opacity = opacity + u_colorBack.a * (1.0 - opacity);

  vec2 fc = v_Uv * u_LM0.xy;
  color += 1.0 / 256.0 * (fract(sin(dot(0.014 * fc, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5);
  outputColor = vec4(color, opacity);
}
`;
