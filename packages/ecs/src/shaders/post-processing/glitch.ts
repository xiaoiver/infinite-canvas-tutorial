/**
 * UV jitter ({@link https://github.com/pmndrs/postprocessing/blob/main/src/effects/glsl/glitch.frag pmndrs glitch.frag})
 * + horizontal RGB split ({@link https://github.com/staffantan/unityglitch/blob/master/GlitchShader.shader Unity GlitchShader}).
 *
 * Uniforms: `u_Glitch0` = (amount 0–1, rgbSplit scale, time seconds, 0), `u_Glitch1` = (texture width, height, 0, 0).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_Glitch0;
  vec4 u_Glitch1;
};

out vec4 outputColor;

vec2 h22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

void main(void) {
  vec2 uv = v_Uv;
  vec2 res = max(u_Glitch1.xy, vec2(1.0));
  float amount = clamp(u_Glitch0.x, 0.0, 1.0);
  float rgbSplit = max(u_Glitch0.y, 0.0);
  float t = u_Glitch0.z;

  vec2 jitter = (h22(uv * 100.0 + t * 17.0) - vec2(0.5)) * amount * 0.012;
  uv += jitter;
  uv = clamp(uv, vec2(0.001), vec2(0.999));

  vec2 eps = vec2((2.0 + rgbSplit * 400.0) / res.x, 0.0) * amount;

  vec4 cr = texture(SAMPLER_2D(u_Texture), uv + eps);
  vec4 cg = texture(SAMPLER_2D(u_Texture), uv);
  vec4 cb = texture(SAMPLER_2D(u_Texture), uv - eps);

  outputColor = vec4(cr.r, cg.g, cb.b, cg.a);
}
`;
