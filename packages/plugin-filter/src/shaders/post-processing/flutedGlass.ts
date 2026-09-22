/**
 * Fluted glass ribbed distortion (paper-design `fluted-glass` fragment).
 * {@link https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/fluted-glass.ts}
 *
 * Post-processing: `v_Uv` replaces `v_imageUV`; mask uses `v_Uv` instead of `gl_FragCoord`.
 * Uniforms packed in `u_FG0`–`u_FG8` (see {@link flutedGlassUniformValues}).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_FG0;
  vec4 u_FG1;
  vec4 u_FG2;
  vec4 u_FG3;
  vec4 u_FG4;
  vec4 u_FG5;
  vec4 u_FG6;
  vec4 u_FG7;
  vec4 u_FG8;
};

out vec4 outputColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float hash21(vec2 p) {
  p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float getUvFrame(vec2 uv, float softness) {
  float aax = 2. * fwidth(uv.x);
  float aay = 2. * fwidth(uv.y);
  float left   = smoothstep(0., aax + softness, uv.x);
  float right  = 1. - smoothstep(1. - softness - aax, 1., uv.x);
  float bottom = smoothstep(0., aay + softness, uv.y);
  float top    = 1. - smoothstep(1. - softness - aay, 1., uv.y);
  return left * right * bottom * top;
}

const int MAX_RADIUS = 50;

vec4 samplePm(vec2 uv) {
  vec4 c = texture(SAMPLER_2D(u_Texture), uv);
  c.rgb *= c.a;
  return c;
}

vec4 getBlur(vec2 uv, vec2 texelSize, vec2 dir, float sigma) {
  if (sigma <= .5) return texture(SAMPLER_2D(u_Texture), uv);
  int radius = int(min(float(MAX_RADIUS), ceil(3.0 * sigma)));

  float twoSigma2 = 2.0 * sigma * sigma;
  float gaussianNorm = 1.0 / sqrt(TWO_PI * sigma * sigma);

  vec4 sum = samplePm(uv) * gaussianNorm;
  float weightSum = gaussianNorm;

  for (int i = 1; i <= MAX_RADIUS; i++) {
    if (i > radius) break;

    float x = float(i);
    float w = exp(-(x * x) / twoSigma2) * gaussianNorm;

    vec2 offset = dir * texelSize * x;
    vec4 s1 = samplePm(uv + offset);
    vec4 s2 = samplePm(uv - offset);

    sum += (s1 + s2) * w;
    weightSum += 2.0 * w;
  }

  vec4 result = sum / weightSum;
  if (result.a > 0.) {
    result.rgb /= result.a;
  }

  return result;
}

vec2 rotateAspect(vec2 p, float a, float aspect) {
  p.x *= aspect;
  p = rotate(p, a);
  p.x /= aspect;
  return p;
}

float smoothFract(float x) {
  float f = fract(x);
  float w = fwidth(x);

  float edge = abs(f - 0.5) - 0.5;
  float band = smoothstep(-w, w, edge);

  return mix(f, 1.0 - f, band);
}

void main() {
  float patternRotation = -u_FG4.z * PI / 180.;
  float patternSize = mix(200., 5., u_FG4.x);

  vec2 uv = v_Uv;

  vec2 uvMask = v_Uv;
  vec2 sw = vec2(.005);
  vec4 margins = vec4(u_FG7.x, u_FG7.z, u_FG7.y, u_FG7.w);
  float mask =
    smoothstep(margins[0], margins[0] + sw.x, uvMask.x + sw.x) *
    smoothstep(margins[2], margins[2] + sw.x, 1.0 - uvMask.x + sw.x) *
    smoothstep(margins[1], margins[1] + sw.y, uvMask.y + sw.y) *
    smoothstep(margins[3], margins[3] + sw.y, 1.0 - uvMask.y + sw.y);
  float maskOuter =
    smoothstep(margins[0] - sw.x, margins[0], uvMask.x + sw.x) *
    smoothstep(margins[2] - sw.x, margins[2], 1.0 - uvMask.x + sw.x) *
    smoothstep(margins[1] - sw.y, margins[1], uvMask.y + sw.y) *
    smoothstep(margins[3] - sw.y, margins[3], 1.0 - uvMask.y + sw.y);
  float maskStroke = maskOuter - mask;
  float maskInner =
    smoothstep(margins[0] - 2. * sw.x, margins[0], uvMask.x) *
    smoothstep(margins[2] - 2. * sw.x, margins[2], 1.0 - uvMask.x) *
    smoothstep(margins[1] - 2. * sw.y, margins[1], uvMask.y) *
    smoothstep(margins[3] - 2. * sw.y, margins[3], 1.0 - uvMask.y);
  float maskStrokeInner = maskInner - mask;

  uv -= .5;
  uv *= patternSize;
  uv = rotateAspect(uv, patternRotation, u_FG0.w);

  float curve = 0.;
  float patternY = uv.y / u_FG0.w;
  if (u_FG5.x > 4.5) {
    curve = .5 + .5 * sin(.5 * PI * uv.x) * cos(.5 * PI * patternY);
  } else if (u_FG5.x > 3.5) {
    curve = 10. * abs(fract(.1 * patternY) - .5);
  } else if (u_FG5.x > 2.5) {
    curve = 4. * sin(.23 * patternY);
  } else if (u_FG5.x > 1.5) {
    curve = .5 + .5 * sin(.5 * uv.x) * sin(1.7 * uv.x);
  }

  vec2 UvToFract = uv + curve;
  vec2 fractOrigUV = fract(uv);
  vec2 floorOrigUV = floor(uv);

  float x = smoothFract(UvToFract.x);
  float xNonSmooth = fract(UvToFract.x) + .0001;

  float highlightsWidth = 2. * max(.001, fwidth(UvToFract.x));
  highlightsWidth += 2. * maskStrokeInner;
  float highlights = smoothstep(0., highlightsWidth, xNonSmooth);
  highlights *= smoothstep(1., 1. - highlightsWidth, xNonSmooth);
  highlights = 1. - highlights;
  highlights *= u_FG5.z;
  highlights = clamp(highlights, 0., 1.);
  highlights *= mask;

  float shadows = pow(x, 1.3);
  float distortion = 0.;
  float fadeX = 1.;
  float frameFade = 0.;

  float aa = fwidth(xNonSmooth);
  aa = max(aa, fwidth(uv.x));
  aa = max(aa, fwidth(UvToFract.x));
  aa = max(aa, .0001);

  if (u_FG5.w == 1.) {
    distortion = -pow(1.5 * x, 3.);
    distortion += (.5 - u_FG6.x);

    frameFade = pow(1.5 * x, 3.);
    aa = max(.2, aa);
    aa += mix(.2, 0., u_FG4.x);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion = mix(.5, distortion, fadeX);
  } else if (u_FG5.w == 2.) {
    distortion = 2. * pow(x, 2.);
    distortion -= (.5 + u_FG6.x);

    frameFade = pow(abs(x - .5), 4.);
    aa = max(.2, aa);
    aa += mix(.2, 0., u_FG4.x);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion = mix(.5, distortion, fadeX);
    frameFade = mix(1., frameFade, .5 * fadeX);
  } else if (u_FG5.w == 3.) {
    distortion = pow(2. * (xNonSmooth - .5), 6.);
    distortion -= .25;
    distortion -= u_FG6.x;

    frameFade = 1. - 2. * pow(abs(x - .4), 2.);
    aa = .15;
    aa += mix(.1, 0., u_FG4.x);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    frameFade = mix(1., frameFade, fadeX);

  } else if (u_FG5.w == 4.) {
    x = xNonSmooth;
    distortion = sin((x + .25) * TWO_PI);
    shadows = .5 + .5 * asin(distortion) / (.5 * PI);
    distortion *= .5;
    distortion -= u_FG6.x;
    frameFade = .5 + .5 * sin(x * TWO_PI);
  } else if (u_FG5.w == 5.) {
    distortion -= pow(abs(x), .2) * x;
    distortion += .33;
    distortion -= 3. * u_FG6.x;
    distortion *= .33;

    frameFade = .3 * (smoothstep(.0, 1., x));
    shadows = pow(x, 2.5);

    aa = max(.1, aa);
    aa += mix(.1, 0., u_FG4.x);
    fadeX = smoothstep(0., aa, xNonSmooth) * smoothstep(1., 1. - aa, xNonSmooth);
    distortion *= fadeX;
  }

  vec2 dudx = dFdx(v_Uv);
  vec2 dudy = dFdy(v_Uv);
  vec2 grainUV = v_Uv - .5;
  grainUV *= (.8 / max(vec2(length(dudx), length(dudy)), vec2(1e-6)));
  grainUV += .5;
  float grain = valueNoise(grainUV);
  grain = smoothstep(.4, .7, grain);
  grain *= u_FG6.w;
  distortion = mix(distortion, 0., grain);

  shadows = min(shadows, 1.);
  shadows += maskStrokeInner;
  shadows *= mask;
  shadows = min(shadows, 1.);
  shadows *= pow(u_FG4.y, 2.);
  shadows = clamp(shadows, 0., 1.);

  distortion *= 3. * u_FG5.y;
  frameFade *= u_FG5.y;

  fractOrigUV.x += distortion;
  floorOrigUV = rotateAspect(floorOrigUV, -patternRotation, u_FG0.w);
  fractOrigUV = rotateAspect(fractOrigUV, -patternRotation, u_FG0.w);

  uv = (floorOrigUV + fractOrigUV) / patternSize;
  uv += pow(maskStroke, 4.);

  uv += vec2(.5);

  uv = mix(v_Uv, uv, smoothstep(0., .7, mask));
  float blur = mix(0., 50., u_FG6.y);
  blur = mix(0., blur, smoothstep(.5, 1., mask));

  float edgeDistortion = mix(.0, .04, u_FG6.z);
  edgeDistortion += .06 * frameFade * u_FG6.z;
  edgeDistortion *= mask;
  float frame = getUvFrame(uv, edgeDistortion);

  float stretch = 1. - smoothstep(0., .5, xNonSmooth) * smoothstep(1., 1. - .5, xNonSmooth);
  stretch = pow(stretch, 2.);
  stretch *= mask;
  stretch *= getUvFrame(uv, .1 + .05 * mask * frameFade);
  uv.y = mix(uv.y, .5, u_FG4.w * stretch);

  vec2 texelSize = vec2(1.0) / u_FG0.xy / u_FG0.z;
  vec4 image = getBlur(uv, texelSize, vec2(0., 1.), blur);
  image.rgb *= image.a;
  vec4 backColor = u_FG1;
  backColor.rgb *= backColor.a;
  vec4 highlightColor = u_FG3;
  highlightColor.rgb *= highlightColor.a;
  vec4 shadowColor = u_FG2;

  vec3 color = highlightColor.rgb * highlights;
  float opacity = highlightColor.a * highlights;

  shadows = mix(shadows * shadowColor.a, 0., highlights);
  color = mix(color, shadowColor.rgb * shadowColor.a, .5 * shadows);
  color += .5 * pow(shadows, .5) * shadowColor.rgb;
  opacity += shadows;
  color = clamp(color, vec3(0.), vec3(1.));
  opacity = clamp(opacity, 0., 1.);

  color += image.rgb * (1. - opacity) * frame;
  opacity += image.a * (1. - opacity) * frame;

  color += backColor.rgb * (1. - opacity);
  opacity += backColor.a * (1. - opacity);

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_FG8.x * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  grainOverlayStrength *= mask;
  color = mix(color, grainOverlayColor, .35 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  outputColor = vec4(color, opacity);
}
`;
