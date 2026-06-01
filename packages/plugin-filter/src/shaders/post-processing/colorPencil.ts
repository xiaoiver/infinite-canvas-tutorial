/**
 * Color pencil — Lu et al. NPAR 2012 (Combining Sketch and Tone for Pencil Drawing Production).
 *
 * CPU path (`u_CP1.y > 0.5`): input is preprocessed final RGB from {@link imageDataToColorPencilProcessed}.
 * GPU fallback: approximate GenStroke + tone LUT + pencil texture modulation in-shader.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
uniform sampler2D u_PencilTexture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_ColorPencil;
  vec4 u_CP1;
  vec4 u_InputSize;
};

out vec4 outputColor;

float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 rgbToYcbcr(vec3 rgb) {
  float y = dot(rgb, vec3(0.299, 0.587, 0.114));
  float cb = 0.564 * (rgb.b - y) + 0.5;
  float cr = 0.713 * (rgb.r - y) + 0.5;
  return vec3(y, cb, cr);
}

vec3 ycbcrToRgb(vec3 ycc) {
  float y = ycc.x;
  float cb = ycc.y;
  float cr = ycc.z;
  float r = y + 1.402 * (cr - 0.5);
  float g = y - 0.344136 * (cb - 0.5) - 0.714136 * (cr - 0.5);
  float b = y + 1.772 * (cb - 0.5);
  return clamp(vec3(r, g, b), 0.0, 1.0);
}

float sampleLumMedian(vec2 uv, vec2 texel) {
  float sum = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec3 c = texture(SAMPLER_2D(u_Texture), uv + vec2(float(i), float(j)) * texel).rgb;
      sum += luminance(c);
    }
  }
  return sum / 9.0;
}

float lineConvResponse(vec2 uv, vec2 texel, float ks, float angleRad) {
  float c = cos(angleRad);
  float s = sin(angleRad);
  float acc = 0.0;
  int n = int(floor(ks));
  for (int t = -16; t <= 16; t++) {
    if (t < -n || t > n) continue;
    vec2 o = vec2(float(t) * c, float(t) * s) * texel;
    float l = luminance(texture(SAMPLER_2D(u_Texture), uv + o).rgb);
    float r = luminance(texture(SAMPLER_2D(u_Texture), uv + o + vec2(texel.x, 0.0)).rgb);
    float d = luminance(texture(SAMPLER_2D(u_Texture), uv + o + vec2(0.0, texel.y)).rgb);
    float cur = l;
    float edge = abs(cur - r) + abs(cur - d);
    acc += edge;
  }
  return acc;
}

float genStrokeGpu(vec2 uv, vec2 texel, float ks, float dirNum, float strokeWidth) {
  float lum = sampleLumMedian(uv, texel);
  float edgeX = abs(lum - luminance(texture(SAMPLER_2D(u_Texture), uv + vec2(texel.x, 0.0)).rgb));
  float edgeY = abs(lum - luminance(texture(SAMPLER_2D(u_Texture), uv + vec2(0.0, texel.y)).rgb));
  float imEdge = edgeX + edgeY;

  float best = 0.0;
  int dirs = int(max(dirNum, 2.0));
  for (int n = 0; n < 16; n++) {
    if (n >= dirs) break;
    float ang = float(n) * 3.14159265 / dirNum;
    float resp = lineConvResponse(uv, texel, ks, ang);
    if (resp > best) {
      best = resp;
    }
  }

  float sp = best * imEdge * max(strokeWidth, 1.0);
  return 1.0 - clamp(sp * 2.5, 0.0, 1.0);
}

void main() {
  vec4 original = texture(SAMPLER_2D(u_Texture), v_Uv);
  vec3 originalRGB = original.rgb;
  if (original.a > 0.0) {
    originalRGB /= original.a;
  }

  if (u_CP1.y > 0.5) {
    outputColor = vec4(originalRGB * original.a, original.a);
    return;
  }

  float gammaS = u_ColorPencil.x;
  float gammaI = u_ColorPencil.y;
  float ks = u_ColorPencil.z;
  float dirNum = u_ColorPencil.w;
  float strokeWidth = u_CP1.x;
  vec2 texel = 1.0 / u_InputSize.xy;

  float S = pow(genStrokeGpu(v_Uv, texel, ks, dirNum, strokeWidth), gammaS);

  float lum = luminance(originalRGB);
  float tone = pow(clamp(lum, 0.02, 1.0), 0.85 * gammaI);

  float P = texture(SAMPLER_2D(u_PencilTexture), v_Uv * 4.0).r;
  P = max(P, 0.02);
  float beta = clamp(log(tone) / log(P), 0.15, 1.5);
  float T = pow(P, beta);

  float newY = S * T;
  vec3 ycc = rgbToYcbcr(originalRGB);
  ycc.x = newY;
  vec3 result = ycbcrToRgb(ycc);

  outputColor = vec4(result * original.a, original.a);
}
`;
