/**
 * Gem smoke: ported from
 * {@link https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/gem-smoke.ts paper-design/gem-smoke}.
 * Image path: R/G 与 paper 的 Poisson 前处理一致（与 `imageDataToLiquidMetalPoissonMap` 同款）。全屏用 `v_Uv`/`u_Texture` 代替
 * `v_imageUV`、固定盒内形状路径与 liquid metal 同构。
 * Uniforms: 12×vec4 = 48 floats → `gemSmokeUniformValues`。
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;
out vec4 outputColor;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_GS0;
  vec4 u_GS1;
  vec4 u_GS2;
  vec4 u_GS3;
  vec4 u_GS4;
  vec4 u_GS5;
  vec4 u_gsC[6];
};

#define PI 3.14159265358979323846
#define NUM_COLORS 6

float sstGS(float a, float b, float x) {
  return smoothstep(a, b, x);
}

vec2 rotGS(vec2 p, float th) {
  float c = cos(th);
  float s = sin(th);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec2 gaussBlur9x9RG(PD_SAMPLER_2D(tex), vec2 dudx, vec2 dudy, vec2 uv, float radius) {
  vec2 texel = 1.0 / max(u_GS0.xy, vec2(1.0));
  vec2 r = max(radius, 0.0) * texel;
  const float k0 = 1.0, k1 = 8.0, k2 = 28.0, k3 = 56.0, k4 = 70.0;
  const float k[9] = float[9](k0, k1, k2, k3, k4, k3, k2, k1, k0);
  vec2 sum = vec2(0.0);
  for (int j = -4; j <= 4; j++) {
    float wy = k[j + 4];
    for (int i = -4; i <= 4; i++) {
      float w = k[i + 4] * wy;
      vec2 off = vec2(float(i) * r.x, float(j) * r.y);
      sum += w * textureGrad(PU_SAMPLER_2D(tex), uv + off, dudx, dudy).rg;
    }
  }
  return sum / 65536.0;
}

void main() {
  float time = u_GS0.z;
  float roundness = 0.0;
  float imgAlpha = 0.0;
  bool usePoisson = u_GS5.z > 0.5;
  float u_isImageF = u_GS5.y;
  float u_shape = u_GS5.x;
  float innerDist = u_GS1.y;
  float outerDist = u_GS1.z;
  float outerGlowP = u_GS1.w;
  float innerGlowP = u_GS2.x;
  float u_offset = u_GS2.y;
  float u_angle = u_GS2.z;
  float u_size = u_GS2.w;
  float colorsCount = u_GS1.x;
  vec4 u_colorBack = u_GS3;
  vec4 u_colorInner = u_GS4;
  vec2 dudx = dFdx(v_Uv);
  vec2 dudy = dFdy(v_Uv);

  if (u_isImageF > 0.5) {
    vec2 imageUV = v_Uv;
    imageUV -= 0.5;
    imageUV *= 0.95;
    imageUV += 0.5;
    if (usePoisson) {
      vec2 blurred = gaussBlur9x9RG(PP_SAMPLER_2D(u_Texture), dudx, dudy, imageUV, 10.0);
      roundness = 1.0 - blurred.x;
    } else {
      vec4 s0 = textureGrad(SAMPLER_2D(u_Texture), v_Uv, dudx, dudy);
      float L = dot(s0.rgb, vec3(0.299, 0.587, 0.114));
      float ed = min(length(dFdx(L)) * u_GS0.x, 1.0) + min(length(dFdy(L)) * u_GS0.y, 1.0);
      ed = min(ed, 1.0);
      roundness = 1.0 - ed;
    }
    vec2 texelA = 1.0 / max(u_GS0.xy, vec2(1.0));
    const float k3[3] = float[3](1.0, 2.0, 1.0);
    for (int j2 = -1; j2 <= 1; j2++) {
      for (int i2 = -1; i2 <= 1; i2++) {
        float kv = k3[i2 + 1] * k3[j2 + 1];
        imgAlpha += kv
          * texture(SAMPLER_2D(u_Texture), v_Uv + vec2(float(i2) * texelA.x, float(j2) * texelA.y)).g;
      }
    }
    imgAlpha /= 16.0;
    if (!usePoisson) {
      imgAlpha = textureGrad(SAMPLER_2D(u_Texture), v_Uv, dudx, dudy).a;
    }
  } else {
    vec2 v_responsiveUV3 = v_Uv - 0.5;
    vec2 v_responsiveBoxGS3 = u_GS0.xy;
    vec2 uvG = (v_Uv - 0.5) + 0.5;
    uvG.y = 1.0 - uvG.y;
    float edge = 0.0;
    if (u_shape < 1.0) {
      vec2 borderUV3 = v_responsiveUV3 + 0.5;
      vec2 maskB3 = min(borderUV3, 1.0 - borderUV3);
      vec2 pt3 = min(250.0 / v_responsiveBoxGS3, vec2(0.5));
      float mxb = smoothstep(0.0, pt3.x, maskB3.x);
      float myb = smoothstep(0.0, pt3.y, maskB3.y);
      mxb = pow(mxb, 0.25);
      myb = pow(myb, 0.25);
      edge = clamp(1.0 - mxb * myb, 0.0, 1.0);
    } else if (u_shape < 2.0) {
      vec2 shapeUV = uvG - 0.5;
      shapeUV *= 0.67;
      edge = pow(clamp(3.0 * length(shapeUV), 0.0, 1.0), 18.0);
    } else if (u_shape < 3.0) {
      vec2 shapeUV = uvG - 0.5;
      shapeUV *= 1.68;
      float r0 = length(shapeUV) * 2.0;
      float a = atan(shapeUV.y, shapeUV.x) + 0.2;
      r0 *= (1.0 + 0.05 * sin(3.0 * a + 2.0 * time));
      float f0 = abs(cos(a * 3.0));
      edge = smoothstep(f0, f0 + 0.7, r0);
      edge *= edge;
    } else if (u_shape < 4.0) {
      vec2 shapeUV = uvG - 0.5;
      shapeUV = rotGS(shapeUV, 0.25 * PI);
      shapeUV *= 1.42;
      shapeUV += 0.5;
      vec2 m2 = min(shapeUV, 1.0 - shapeUV);
      vec2 pixel_thickness2 = vec2(0.15);
      float mX2 = smoothstep(0.0, pixel_thickness2.x, m2.x);
      float mY2 = smoothstep(0.0, pixel_thickness2.y, m2.y);
      mX2 = pow(mX2, 0.25);
      mY2 = pow(mY2, 0.25);
      edge = clamp(1.0 - mX2 * mY2, 0.0, 1.0);
    } else {
      vec2 shapeUVm = uvG - 0.5;
      shapeUVm *= 1.3;
      edge = 0.0;
      for (int ii = 0; ii < 5; ii++) {
        float fi2 = float(ii);
        float speed = 1.5 + 2.0 / 3.0 * sin(fi2 * 12.345);
        float an = -fi2 * 1.5;
        vec2 dir1 = vec2(cos(an), sin(an));
        vec2 dir2 = vec2(cos(an + 1.57), sin(an + 1.57));
        vec2 traj2 = 0.4
          * (dir1 * sin(time * speed + fi2 * 1.23) + dir2 * cos(time * (speed * 0.7) + fi2 * 2.17));
        float d2 = length(shapeUVm + traj2);
        edge += pow(1.0 - clamp(d2, 0.0, 1.0), 4.0);
      }
      edge = 1.0 - smoothstep(0.65, 0.9, edge);
      edge = pow(edge, 4.0);
    }
    imgAlpha = 1.0 - smoothstep(0.9 - 2.0 * fwidth(edge), 0.9, edge);
    roundness = 1.0 - edge;
  }

  vec2 smokeUV = v_Uv - 0.5;
  smokeUV = rotGS(smokeUV, u_angle * PI / 180.0);
  smokeUV *= mix(4.0, 1.0, u_size);

  vec2 innerUV = smokeUV;
  vec2 outerUV = smokeUV;

  innerUV.y += innerDist * (1.0 - sstGS(0.0, 1.0, length(0.4 * innerUV)));
  innerUV.y -= 0.4 * innerDist;
  innerUV.y += 0.7 * u_offset * roundness;
  outerUV.y += outerDist * (1.0 - sstGS(0.0, 1.0, length(0.4 * outerUV)));
  outerUV.y -= 0.4 * outerDist;
  float innerSwirl = innerDist * roundness;
  float outerSwirl = outerDist;

  for (int isw = 1; isw < 5; isw++) {
    float fi3 = float(isw);
    float stretchIn2 = max(length(dFdx(innerUV)), length(dFdy(innerUV)));
    float dampenIn2 = 1.0 / (1.0 + stretchIn2 * 8.0);
    float sIn2 = innerSwirl * dampenIn2;
    innerUV.x += sIn2 / fi3 * cos(time + fi3 * 2.9 * innerUV.y);
    innerUV.y += sIn2 / fi3 * cos(time + fi3 * 1.5 * innerUV.x);
    float stretchOut2 = max(length(dFdx(outerUV)), length(dFdy(outerUV)));
    float dampenOut2 = 1.0 / (1.0 + stretchOut2 * 8.0);
    float sOut2 = outerSwirl * dampenOut2;
    outerUV.x += sOut2 / fi3 * cos(time + fi3 * 2.9 * outerUV.y);
    outerUV.y += sOut2 / fi3 * cos(time + fi3 * 1.5 * outerUV.x);
  }

  float innerShapeG = exp(-1.5 * dot(innerUV, innerUV));
  float outerShapeG = exp(-1.5 * dot(outerUV, outerUV));
  float outerMaskG = pow(outerGlowP, 2.0) * (1.0 - imgAlpha);
  float innerMaskG = (0.01 + 0.99 * innerGlowP) * imgAlpha;
  innerShapeG *= innerMaskG;
  outerShapeG *= outerMaskG;
  float mixer2 = (innerShapeG + outerShapeG) * colorsCount;
  vec4 gradient2 = u_gsC[0];
  gradient2.rgb *= gradient2.a;
  float smokeMask2 = 0.0;
  for (int ic = 1; ic <= NUM_COLORS; ic++) {
    if (ic > int(colorsCount + 0.5)) {
      break;
    }
    float m2b = sstGS(0.0, 1.0, clamp(mixer2 - float(ic - 1), 0.0, 1.0));
    if (ic == 1) {
      smokeMask2 = m2b;
    }
    vec4 c2b = u_gsC[ic - 1];
    c2b.rgb *= c2b.a;
    gradient2 = mix(gradient2, c2b, m2b);
  }
  vec3 color = gradient2.rgb * smokeMask2;
  float opacity = gradient2.a * smokeMask2;
  float innerOpacity2 = u_colorInner.a * imgAlpha;
  vec3 innerColor2 = u_colorInner.rgb * innerOpacity2;
  color += innerColor2 * (1.0 - opacity);
  opacity += innerOpacity2 * (1.0 - opacity);
  vec3 backC = u_colorBack.rgb * u_colorBack.a;
  color += backC * (1.0 - opacity);
  opacity += u_colorBack.a * (1.0 - opacity);
  outputColor = vec4(color, opacity);
}
`;
