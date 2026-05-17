/**
 * Codrops {@link https://github.com/codrops/RainEffect/blob/master/src/shaders/water.frag water.frag}
 * adapted for ECS post: `v_Uv` replaces `gl_FragCoord`-based `texCoord()`, single {@link u_Texture}
 * for both background and foreground samples (per-layer raster has no separate bg image).
 * Second sampler {@link u_waterMap} is the liquid canvas from {@link RaindropsCodropsSimulator}.
 * Third sampler {@link u_textureShine} is the Codrops shine sprite (optional via {@link RainEffect.dropShineUrl}).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
uniform sampler2D u_waterMap;
uniform sampler2D u_textureShine;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_RW0;
  vec4 u_RW1;
  vec4 u_RW2;
  vec4 u_RW3;
};

out vec4 outputColor;

vec4 blendRw(vec4 bg, vec4 fg) {
  vec3 bgm = bg.rgb * bg.a;
  vec3 fgm = fg.rgb * fg.a;
  float ia = 1.0 - fg.a;
  float a = fg.a + bg.a * ia;
  vec3 rgb;
  if (a > 1e-6) {
    rgb = (fgm + bgm * ia) / a;
  } else {
    rgb = vec3(0.0);
  }
  return vec4(rgb, a);
}

vec2 pixelRw() {
  return vec2(1.0, 1.0) / max(u_RW0.xy, vec2(1.0));
}

vec2 scaledTexCoordRw() {
  float ratio = u_RW0.x / max(u_RW0.y, 1.0);
  vec2 scale = vec2(1.0, 1.0);
  vec2 offset = vec2(0.0, 0.0);
  float u_textureRatio = u_RW0.z;
  float ratioDelta = ratio - u_textureRatio;
  if (ratioDelta >= 0.0) {
    scale.y = (1.0 + ratioDelta);
    offset.y = ratioDelta / 2.0;
  } else {
    scale.x = (1.0 - ratioDelta);
    offset.x = -ratioDelta / 2.0;
  }
  return (v_Uv + offset) / scale;
}

vec4 fgColorRw(float x, float y) {
  return texture(
    SAMPLER_2D(u_waterMap),
    scaledTexCoordRw() + pixelRw() * vec2(x, y)
  );
}

void main() {
  float u_minRefraction = u_RW2.x;
  float u_refractionDelta = u_RW2.y;
  float u_brightness = u_RW2.z;
  float u_alphaMultiply = u_RW2.w;
  float u_alphaSubtract = u_RW3.x;
  float u_renderShadow = u_RW3.y;
  float u_renderShine = u_RW3.z;
  float u_hasShineTexture = u_RW3.w;

  vec4 bg = texture(SAMPLER_2D(u_Texture), scaledTexCoordRw());

  vec4 cur = fgColorRw(0.0, 0.0);
  float d = cur.b;
  float x = cur.g;
  float y = cur.r;
  float a = clamp(cur.a * u_alphaMultiply - u_alphaSubtract, 0.0, 1.0);
  vec2 refraction = (vec2(x, y) - 0.5) * 2.0;
  float damp = min(1.0, max(u_RW0.x, u_RW0.y) / 960.0);
  vec2 refractionPos =
    scaledTexCoordRw()
    + pixelRw() * refraction * (u_minRefraction + d * u_refractionDelta) * damp;
  refractionPos = clamp(refractionPos, vec2(0.001), vec2(0.999));

  vec4 tex = texture(SAMPLER_2D(u_Texture), refractionPos);

  if (u_renderShine > 0.5 && u_hasShineTexture > 0.5) {
    float maxShine = 490.0;
    float minShine = maxShine * 0.18;
    vec2 shinePos =
      vec2(0.5, 0.5)
      + ((1.0 / 512.0) * refraction) * -(minShine + ((maxShine - minShine) * d));
    shinePos = clamp(shinePos, vec2(0.001), vec2(0.999));
    vec4 shine = texture(SAMPLER_2D(u_textureShine), shinePos);
    tex = blendRw(tex, shine);
  }

  vec4 fg = vec4(tex.rgb * u_brightness, a);

  if (u_renderShadow > 0.5) {
    float borderAlpha = fgColorRw(0.0, -(d * 6.0)).a;
    borderAlpha = borderAlpha * u_alphaMultiply - (u_alphaSubtract + 0.5);
    borderAlpha = clamp(borderAlpha, 0.0, 1.0) * 0.2;
    vec4 border = vec4(0.0, 0.0, 0.0, borderAlpha);
    fg = blendRw(border, fg);
  }

  outputColor = blendRw(bg, fg);
}
`;
