/**
 * Codrops RainEffect-style refraction on a fullscreen pass: simulates the liquid map from
 * {@link https://github.com/codrops/RainEffect/blob/master/src/shaders/water.frag water.frag}
 * with a procedural rain height field (no separate WebGL rain sim).
 * Uniforms: {@link rainUniformValues} → `u_RN0`–`u_RN3`.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_RN0;
  vec4 u_RN1;
  vec4 u_RN2;
  vec4 u_RN3;
};

out vec4 outputColor;

float hash12Rn(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float rainHeight(vec2 uv, float t, float streakCols, float density) {
  float cols = max(8.0, streakCols * max(0.15, density));
  float col = floor(uv.x * cols);
  float u = fract(uv.x * cols);
  float rnd1 = hash12Rn(vec2(col, 17.3));
  float rnd2 = hash12Rn(vec2(col, 42.1));
  float speed = mix(0.2, 0.95, rnd1);
  float phase = rnd2 * 6.2831853;
  float yAnim = fract(uv.y * 2.5 * max(0.25, density) + t * speed * 0.35 + phase * 0.01);
  float streak = exp(-pow((yAnim - 0.32) * 11.0, 2.0));
  streak *= sin(u * 3.14159265) * 0.5 + 0.5;
  streak *= smoothstep(0.0, 0.14, u) * smoothstep(1.0, 0.86, u);

  vec2 g = uv * vec2(38.0, 28.0) * max(0.2, density);
  vec2 gid = floor(g);
  vec2 gv = fract(g) - 0.5;
  float r = hash12Rn(gid + floor(t * 2.0));
  float drop = smoothstep(0.38, 0.0, length(gv)) * step(0.9, r);

  return clamp(streak * 0.58 + drop * 0.42, 0.0, 1.0);
}

vec2 pixelRn() {
  return vec2(1.0, 1.0) / max(u_RN0.xy, vec2(1.0));
}

void main() {
  float timeSec = u_RN0.z;
  float minRef = u_RN1.x;
  float refDelta = u_RN1.y;
  float brightness = u_RN1.z;
  float density = u_RN1.w;
  float alphaMul = u_RN2.x;
  float alphaSub = u_RN2.y;
  float streakCols = u_RN2.z;
  float dropScale = u_RN2.w;
  float renderShadow = u_RN3.z;
  float renderShine = u_RN3.w;

  vec2 duv = pixelRn() * vec2(1.6, 1.6);

  float h0 = rainHeight(v_Uv, timeSec, streakCols, density * dropScale);
  float hxp = rainHeight(v_Uv + vec2(duv.x, 0.0), timeSec, streakCols, density * dropScale);
  float hxm = rainHeight(v_Uv - vec2(duv.x, 0.0), timeSec, streakCols, density * dropScale);
  float hyp = rainHeight(v_Uv + vec2(0.0, duv.y), timeSec, streakCols, density * dropScale);
  float hym = rainHeight(v_Uv - vec2(0.0, duv.y), timeSec, streakCols, density * dropScale);

  float gx = (hxp - hxm) * 0.5;
  float gy = (hyp - hym) * 0.5;
  vec2 refractionEnc = clamp(vec2(0.5, 0.5) + vec2(gx, gy) * 3.5, vec2(0.001), vec2(0.999));
  vec2 refraction = (refractionEnc - 0.5) * 2.0;

  float d = h0;
  float a = clamp(h0 * alphaMul - alphaSub, 0.0, 1.0);

  float refrScale = minRef + d * refDelta;
  vec2 refractUv = v_Uv + pixelRn() * refraction * refrScale;

  refractUv = clamp(refractUv, vec2(0.001), vec2(0.999));

  vec4 tex = texture(SAMPLER_2D(u_Texture), refractUv);

  if (renderShine > 0.5) {
    float glint = clamp(length(refraction) * 0.35, 0.0, 1.0);
    vec4 shineCol = vec4(1.0, 1.0, 1.0, 0.22 * max(a, 0.08) * (0.35 + glint));
    vec3 fgm = shineCol.rgb * shineCol.a;
    vec3 tbm = tex.rgb * tex.a;
    float ia = 1.0 - shineCol.a;
    float sa = shineCol.a + tex.a * ia;
    if (sa > 1e-5) {
      tex = vec4((fgm + tbm * ia) / sa, sa);
    }
  }

  vec3 rgb = tex.rgb * brightness;

  if (renderShadow > 0.5) {
    float borderH = rainHeight(
      v_Uv + vec2(0.0, -pixelRn().y * d * 6.0),
      timeSec,
      streakCols,
      density * dropScale
    );
    float borderAlpha = clamp(borderH * alphaMul - (alphaSub + 0.5), 0.0, 1.0) * 0.2;
    rgb *= (1.0 - borderAlpha);
  }

  outputColor = vec4(rgb, tex.a);
}
`;
