/**
 * Luminance-driven halftone dots (paper-design `halftone-dots` fragment, minimal MVP).
 * {@link https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/halftone-dots.ts}
 *
 * Fixed: `fit = none`, no image UV transform (use `v_Uv` as `v_imageUV`). Sizing / rotation / offset
 * from paper’s vertex stage are omitted. Exposed via `u_H0`–`u_H4`: size, radius, contrast, grid,
 * dot style, `originalColors` (`u_H1.z`); grain uses CPU defaults.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_H0;
  vec4 u_H1;
  vec4 u_H2;
  vec4 u_H3;
  vec4 u_H4;
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

float lst(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float sst(float edge0, float edge1, float x) {
  return smoothstep(edge0, edge1, x);
}

float getCircle(vec2 uv, float r, float baseR) {
  r = mix(.25 * baseR, 0., r);
  float d = length(uv - .5);
  float aa = fwidth(d);
  return 1. - smoothstep(r - aa, r + aa, d);
}

float getCell(vec2 uv) {
  float insideX = step(0.0, uv.x) * (1.0 - step(1.0, uv.x));
  float insideY = step(0.0, uv.y) * (1.0 - step(1.0, uv.y));
  return insideX * insideY;
}

float getCircleWithHole(vec2 uv, float r, float baseR) {
  float cell = getCell(uv);

  r = mix(.75 * baseR, 0., r);
  float rMod = mod(r, .5);

  float d = length(uv - .5);
  float aa = fwidth(d);
  float circle = 1. - smoothstep(rMod - aa, rMod + aa, d);
  if (r < .5) {
    return circle;
  } else {
    return cell - circle;
  }
}

float getGooeyBall(vec2 uv, float r, float baseR) {
  float d = length(uv - .5);
  float sizeRadius = .3;
  if (u_H1.x == 1.) {
    sizeRadius = .42;
  }
  sizeRadius = mix(sizeRadius * baseR, 0., r);
  d = 1. - sst(0., sizeRadius, d);

  d = pow(d, 2. + baseR);
  return d;
}

float getSoftBall(vec2 uv, float r, float baseR) {
  float d = length(uv - .5);
  float sizeRadius = clamp(baseR, 0., 1.);
  sizeRadius = mix(.5 * sizeRadius, 0., r);
  d = 1. - lst(0., sizeRadius, d);
  float powRadius = 1. - lst(0., 2., baseR);
  d = pow(d, 4. + 3. * powRadius);
  return d;
}

float getUvFrame(vec2 uv, vec2 pad) {
  float aa = 0.0001;

  float left   = smoothstep(-pad.x, -pad.x + aa, uv.x);
  float right  = smoothstep(1.0 + pad.x, 1.0 + pad.x - aa, uv.x);
  float bottom = smoothstep(-pad.y, -pad.y + aa, uv.y);
  float top    = smoothstep(1.0 + pad.y, 1.0 + pad.y - aa, uv.y);

  return left * right * bottom * top;
}

float sigmoid(float x, float k) {
  return 1.0 / (1.0 + exp(-k * (x - 0.5)));
}

float getLumAtPx(vec2 uv, float contrastK) {
  vec4 tex = texture(SAMPLER_2D(u_Texture), uv);
  vec3 color = vec3(
    sigmoid(tex.r, contrastK),
    sigmoid(tex.g, contrastK),
    sigmoid(tex.b, contrastK)
  );
  float lum = dot(vec3(0.2126, 0.7152, 0.0722), color);
  lum = mix(1., lum, tex.a);
  lum = (u_H1.w > 0.5) ? (1. - lum) : lum;
  return lum;
}

float getLumBall(vec2 p, vec2 pad, vec2 inCellOffset, float contrastK, float baseR, float stepSize, out vec4 ballColor) {
  p += inCellOffset;
  vec2 uv_i = floor(p);
  vec2 uv_f = fract(p);
  vec2 samplingUV = (uv_i + .5 - inCellOffset) * pad + vec2(.5);
  float outOfFrame = getUvFrame(samplingUV, pad * stepSize);

  float lum = getLumAtPx(samplingUV, contrastK);
  ballColor = texture(SAMPLER_2D(u_Texture), samplingUV);
  ballColor.rgb *= ballColor.a;
  ballColor *= outOfFrame;

  float ball = 0.;
  if (u_H1.y == 0.) {
    ball = getCircle(uv_f, lum, baseR);
  } else if (u_H1.y == 1.) {
    ball = getGooeyBall(uv_f, lum, baseR);
  } else if (u_H1.y == 2.) {
    ball = getCircleWithHole(uv_f, lum, baseR);
  } else if (u_H1.y == 3.) {
    ball = getSoftBall(uv_f, lum, baseR);
  }

  return ball * outOfFrame;
}

void main() {
  float stepMultiplier = 1.;
  if (u_H1.y == 0.) {
    stepMultiplier = 2.;
  } else if (u_H1.y == 1. || u_H1.y == 3.) {
    stepMultiplier = 6.;
  }

  float cellsPerSide = mix(300., 7., pow(u_H0.x, .7));
  cellsPerSide /= stepMultiplier;
  float cellSizeY = 1. / cellsPerSide;
  vec2 pad = cellSizeY * vec2(1. / u_H0.w, 1.);
  if (u_H1.y == 1. && u_H1.x == 1.) {
    pad *= .7;
  }

  vec2 uv = v_Uv;
  uv -= vec2(.5);
  uv /= pad;

  float contrastK = mix(0., 15., pow(u_H0.z, 1.5));
  float baseRadius = u_H0.y;
  if (u_H1.z > 0.5) {
    contrastK = mix(.1, 4., pow(u_H0.z, 2.));
    baseRadius = 2. * pow(.5 * u_H0.y, .3);
  }

  float totalShape = 0.;
  vec3 totalColor = vec3(0.);
  float totalOpacity = 0.;

  vec4 ballColor;
  float shape;
  float stepSize = 1. / stepMultiplier;
  for (float x = -0.5; x < 0.5; x += stepSize) {
    for (float y = -0.5; y < 0.5; y += stepSize) {
      vec2 offset = vec2(x, y);

      if (u_H1.x == 1.) {
        float rowIndex = floor((y + .5) / stepSize);
        float colIndex = floor((x + .5) / stepSize);
        if (stepSize == 1.) {
          rowIndex = floor(uv.y + y + 1.);
          if (u_H1.y == 1.) {
            colIndex = floor(uv.x + x + 1.);
          }
        }
        if (u_H1.y == 1.) {
          if (mod(rowIndex + colIndex, 2.) == 1.) {
            continue;
          }
        } else {
          if (mod(rowIndex, 2.) == 1.) {
            offset.x += .5 * stepSize;
          }
        }
      }

      shape = getLumBall(uv, pad, offset, contrastK, baseRadius, stepSize, ballColor);
      totalColor   += ballColor.rgb * shape;
      totalShape   += shape;
      totalOpacity += shape;
    }
  }

  const float eps = 1e-4;

  totalColor /= max(totalShape, eps);
  totalOpacity /= max(totalShape, eps);

  float finalShape = 0.;
  if (u_H1.y == 0.) {
    finalShape = min(1., totalShape);
  } else if (u_H1.y == 1.) {
    float aa = fwidth(totalShape);
    float th = .5;
    finalShape = smoothstep(th - aa, th + aa, totalShape);
  } else if (u_H1.y == 2.) {
    finalShape = min(1., totalShape);
  } else if (u_H1.y == 3.) {
    finalShape = totalShape;
  }

  vec2 grainSz = mix(2000., 200., u_H2.z) * vec2(1., 1. / u_H0.w);
  vec2 grainUV = v_Uv - .5;
  grainUV *= grainSz;
  grainUV += .5;
  float grain = valueNoise(grainUV);
  grain = smoothstep(.55, .7 + .2 * u_H2.x, grain);
  grain *= u_H2.x;
  finalShape = mix(finalShape, 0., grain);

  vec3 color = vec3(0.);
  float opacity = 0.;

  if (u_H1.z > 0.5) {
    color = totalColor * finalShape;
    opacity = totalOpacity * finalShape;

    vec3 bgColor = u_H4.rgb * u_H4.a;
    color = color + bgColor * (1. - opacity);
    opacity = opacity + u_H4.a * (1. - opacity);
  } else {
    vec3 fgColor = u_H3.rgb * u_H3.a;
    float fgOpacity = u_H3.a;
    vec3 bgColor = u_H4.rgb * u_H4.a;
    float bgOpacity = u_H4.a;

    color = fgColor * finalShape;
    opacity = fgOpacity * finalShape;
    color += bgColor * (1. - opacity);
    opacity += bgOpacity * (1. - opacity);
  }

  float grainOverlay = valueNoise(rotate(grainUV, 1.) + vec2(3.));
  grainOverlay = mix(grainOverlay, valueNoise(rotate(grainUV, 2.) + vec2(-1.)), .5);
  grainOverlay = pow(grainOverlay, 1.3);

  float grainOverlayV = grainOverlay * 2. - 1.;
  vec3 grainOverlayColor = vec3(step(0., grainOverlayV));
  float grainOverlayStrength = u_H2.y * abs(grainOverlayV);
  grainOverlayStrength = pow(grainOverlayStrength, .8);
  color = mix(color, grainOverlayColor, .5 * grainOverlayStrength);

  opacity += .5 * grainOverlayStrength;
  opacity = clamp(opacity, 0., 1.);

  outputColor = vec4(color, opacity);
}
`;
