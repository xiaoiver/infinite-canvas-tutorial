/**
 * Heatmap: ported from
 * {@link https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/heatmap.ts paper-design/heatmap}.
 * Fullscreen: `v_Uv` / `u_Texture`. When `u_HM2.z>0.5`, texture is CPU R/G/B pre-blur; else WebGPU-style luma fallback.
 * Uniforms: {@link heatmapUniformValues} → `u_HM0`…`u_HM3`, `u_hmC[10]` (14×vec4 = 56 floats).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;
out vec4 outputColor;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_HM0;
  vec4 u_HM1;
  vec4 u_HM2;
  vec4 u_HM3;
  vec4 u_hmC[10];
};

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

float getImgFrame(vec2 uv, float th) {
  float frame = 1.0;
  frame *= smoothstep(0.0, th, uv.y);
  frame *= 1.0 - smoothstep(1.0 - th, 1.0, uv.y);
  frame *= smoothstep(0.0, th, uv.x);
  frame *= 1.0 - smoothstep(1.0 - th, 1.0, uv.x);
  return frame;
}

float circleH(vec2 uv, vec2 c, vec2 r) {
  return 1.0 - smoothstep(r[0], r[1], length(uv - c));
}

float lstH(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float sstH(float edge0, float edge1, float x) {
  return smoothstep(edge0, edge1, x);
}

float shadowShapeH(vec2 uv, float t, float contour) {
  vec2 scaledUV = uv;

  float posY = mix(-1.0, 2.0, t);

  scaledUV.y -= 0.5;
  float mainCircleScale = sstH(0.0, 0.8, posY) * lstH(1.4, 0.9, posY);
  scaledUV *= vec2(1.0, 1.0 + 1.5 * mainCircleScale);
  scaledUV.y += 0.5;

  float innerR = 0.4;
  float outerR = 1.0 - 0.3 * (sstH(0.1, 0.2, t) * (1.0 - sstH(0.2, 0.5, t)));
  float s = circleH(scaledUV, vec2(0.5, posY - 0.2), vec2(innerR, outerR));
  s = pow(s, 1.4);
  s *= 1.2;

  float topFlattener = 0.0;
  {
    float pos = posY - uv.y;
    float edge = 1.2;
    topFlattener = lstH(-0.4, 0.0, pos) * (1.0 - sstH(0.0, edge, pos));
    topFlattener = pow(topFlattener, 3.0);
    float topFlattenerMixer = (1.0 - sstH(0.0, 0.3, pos));
    s = mix(topFlattener, s, topFlattenerMixer);
  }

  {
    float visibility = sstH(0.6, 0.7, t) * (1.0 - sstH(0.8, 0.9, t));
    float angle = -2.0 - t * TWO_PI;
    float rightCircle = circleH(
      uv,
      vec2(0.95 - 0.2 * cos(angle), 0.4 - 0.1 * sin(angle)),
      vec2(0.15, 0.3)
    );
    rightCircle *= visibility;
    s = mix(s, 0.0, rightCircle);
  }

  {
    float topCircle = circleH(uv, vec2(0.5, 0.19), vec2(0.05, 0.25));
    topCircle += 2.0 * contour * circleH(uv, vec2(0.5, 0.19), vec2(0.2, 0.5));
    float visibility = 0.55 * sstH(0.2, 0.3, t) * (1.0 - sstH(0.3, 0.45, t));
    topCircle *= visibility;
    s = mix(s, 0.0, topCircle);
  }

  float leafMask = circleH(uv, vec2(0.53, 0.13), vec2(0.08, 0.19));
  leafMask = mix(leafMask, 0.0, 1.0 - sstH(0.4, 0.54, uv.x));
  leafMask = mix(0.0, leafMask, sstH(0.0, 0.2, uv.y));
  leafMask *= (sstH(0.5, 1.1, posY) * sstH(1.5, 1.3, posY));
  s += leafMask;

  {
    float visibility = sstH(0.0, 0.4, t) * (1.0 - sstH(0.6, 0.8, t));
    s = mix(s, 0.0, visibility * circleH(uv, vec2(0.52, 0.92), vec2(0.09, 0.25)));
  }

  {
    float pos = sstH(0.0, 0.6, t) * (1.0 - sstH(0.6, 1.0, t));
    s = mix(s, 0.5, circleH(uv, vec2(0.0, 1.2 - 0.5 * pos), vec2(0.1, 0.3)));
    s = mix(s, 0.0, circleH(uv, vec2(1.0, 0.5 + 0.5 * pos), vec2(0.1, 0.3)));
    s = mix(s, 1.0, circleH(uv, vec2(0.95, 0.2 + 0.2 * sstH(0.3, 0.4, t) * sstH(0.7, 0.5, t)), vec2(0.07, 0.22)));
    s = mix(s, 1.0, circleH(uv, vec2(0.95, 0.2 + 0.2 * sstH(0.3, 0.4, t) * (1.0 - sstH(0.5, 0.7, t))), vec2(0.07, 0.22)));
    s /= max(1e-4, sstH(1.0, 0.85, uv.y));
  }

  s = clamp(0.0, 1.0, s);
  return s;
}

float blurEdge3x3Hm(
  PD_SAMPLER_2D(tex), vec2 uv, vec2 dudx, vec2 dudy, float radius, float centerSample) {
  vec2 texel = 1.0 / max(u_HM0.xy, vec2(1.0));
  vec2 r = radius * texel;
  float w1 = 1.0, w2 = 2.0, w4 = 4.0;
  float norm = 16.0;
  float sum = w4 * centerSample;
  sum += w2 * textureGrad(PU_SAMPLER_2D(tex), uv + vec2(0.0, -r.y), dudx, dudy).g;
  sum += w2 * textureGrad(PU_SAMPLER_2D(tex), uv + vec2(0.0, r.y), dudx, dudy).g;
  sum += w2 * textureGrad(PU_SAMPLER_2D(tex), uv + vec2(-r.x, 0.0), dudx, dudy).g;
  sum += w2 * textureGrad(PU_SAMPLER_2D(tex), uv + vec2(r.x, 0.0), dudx, dudy).g;
  sum += w1 * textureGrad(PU_SAMPLER_2D(tex), uv + vec2(-r.x, -r.y), dudx, dudy).g;
  sum += w1 * textureGrad(PU_SAMPLER_2D(tex), uv + vec2(r.x, -r.y), dudx, dudy).g;
  sum += w1 * textureGrad(PU_SAMPLER_2D(tex), uv + vec2(-r.x, r.y), dudx, dudy).g;
  sum += w1 * textureGrad(PU_SAMPLER_2D(tex), uv + vec2(r.x, r.y), dudx, dudy).g;
  return sum / norm;
}

void main() {
  vec2 dudx = dFdx(v_Uv);
  vec2 dudy = dFdy(v_Uv);
  vec2 imgUV = v_Uv;
  float imgSoftFrame = getImgFrame(imgUV, 0.03);
  vec4 img = textureGrad(SAMPLER_2D(u_Texture), v_Uv, dudx, dudy);
  bool preprocessed = u_HM2.z > 0.5;
  if (!preprocessed) {
    float L = dot(img.rgb, vec3(0.299, 0.587, 0.114));
    float ed = min(length(dFdx(L)) * u_HM0.x, 1.0) + min(length(dFdy(L)) * u_HM0.y, 1.0);
    ed = min(ed, 1.0);
    img = vec4(ed, L, L * 0.95, img.a);
  } else {
    img[1] = blurEdge3x3Hm(PP_SAMPLER_2D(u_Texture), imgUV, dudx, dudy, 8.0, img[1]);
  }
  if (img.a < 0.0001) {
    outputColor = u_HM3;
    return;
  }
  float u_time = u_HM0.z;
  float t = 0.1 * u_time;
  t -= 0.3;
  float tCopy = t + 1.0 / 3.0;
  float tCopy2 = t + 2.0 / 3.0;
  t = mod(t, 1.0);
  tCopy = mod(tCopy, 1.0);
  tCopy2 = mod(tCopy2, 1.0);

  vec2 objectUV = v_Uv - 0.5;
  vec2 animationUV = imgUV - 0.5;
  float angleH = -u_HM1.w * PI / 180.0;
  float cosA = cos(angleH);
  float sinA = sin(angleH);
  animationUV = vec2(
    animationUV.x * cosA - animationUV.y * sinA,
    animationUV.x * sinA + animationUV.y * cosA
  ) + 0.5;

  float shape = img[0];
  float outerBlur = 1.0 - mix(1.0, img[1], shape);
  float innerBlur = mix(img[1], 0.0, shape);
  float contourG = mix(img[2], 0.0, shape);
  outerBlur *= imgSoftFrame;

  vec2 uv = objectUV + 0.5;
  uv.y = 1.0 - uv.y;
  float innerBlurShape = (u_HM2.z < 0.5) ? innerBlur * 0.4 : innerBlur;
  float shadow = shadowShapeH(uv, t, innerBlurShape);
  float shadowCopy = shadowShapeH(uv, tCopy, innerBlurShape);
  float shadowCopy2 = shadowShapeH(uv, tCopy2, innerBlurShape);

  float inner = 0.8 + 0.8 * innerBlur;
  inner = mix(inner, 0.0, shadow);
  inner = mix(inner, 0.0, shadowCopy);
  inner = mix(inner, 0.0, shadowCopy2);
  inner *= mix(0.0, 2.0, u_HM2.x);
  inner += (u_HM1.z * 2.0) * contourG;
  inner = min(1.0, inner);
  inner *= (1.0 - shape);
  float outer = 0.0;
  {
    float tOut = t;
    tOut *= 3.0;
    tOut = mod(tOut - 0.1, 1.0);
    outer = 0.9 * pow(outerBlur, 0.8);
    float y = mod(animationUV.y - tOut, 1.0);
    float animatedMask = sstH(0.3, 0.65, y) * (1.0 - sstH(0.65, 1.0, y));
    animatedMask = 0.5 + animatedMask;
    outer *= animatedMask;
    outer *= mix(0.0, 5.0, pow(u_HM2.y, 2.0));
    outer *= imgSoftFrame;
  }
  inner = pow(inner, 1.2);
  float heat = clamp(inner + outer, 0.0, 1.0);
  float u_noise = u_HM1.y;
  heat += (0.005 + 0.35 * u_noise)
    * (fract(sin(dot((v_Uv * vec2(1.0, -1.0)) + 1.0, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5);
  float mixer = heat * u_HM0.w;
  float colorsCountF = u_HM0.w;
  vec4 gradient = u_hmC[0];
  gradient.rgb *= gradient.a;
  float outerShape = 0.0;
  for (int i = 1; i < 11; i++) {
    if (i > int(colorsCountF + 0.5)) {
      break;
    }
    float m = clamp(mixer - float(i - 1), 0.0, 1.0);
    if (i == 1) {
      outerShape = m;
    }
    vec4 c = u_hmC[i - 1];
    c.rgb *= c.a;
    gradient = mix(gradient, c, m);
  }
  vec3 color = gradient.rgb * outerShape;
  float opacity = gradient.a * outerShape;
  vec3 bgColor = u_HM3.rgb * u_HM3.a;
  color = color + bgColor * (1.0 - opacity);
  opacity = opacity + u_HM3.a * (1.0 - opacity);
  color += 0.02
    * (fract(sin(dot(v_Uv * vec2(1.0, -1.0) + 1.0, vec2(12.9898, 78.233))) * 43758.5453123) - 0.5);
  outputColor = vec4(color, opacity);
}
`;
