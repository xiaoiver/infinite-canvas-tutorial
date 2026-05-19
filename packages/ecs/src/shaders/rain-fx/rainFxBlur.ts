/** Port of raindrop-fx blur.glsl (4-tap box down/up sample). */
export const frag = /* glsl */ `
uniform sampler2D u_Texture;
layout(std140) uniform RainFxBlurUniforms {
  vec4 u_TexSize;
  float u_SampleOffset;
};
in vec2 v_UV;
out vec4 outputColor;

void main() {
  vec2 delta = vec2(-u_SampleOffset, u_SampleOffset);
  vec4 color =
    texture(SAMPLER_2D(u_Texture), clamp(v_UV + u_TexSize.zw * delta.xx, vec2(0.0), vec2(1.0)))
    + texture(SAMPLER_2D(u_Texture), clamp(v_UV + u_TexSize.zw * delta.yx, vec2(0.0), vec2(1.0)))
    + texture(SAMPLER_2D(u_Texture), clamp(v_UV + u_TexSize.zw * delta.yy, vec2(0.0), vec2(1.0)))
    + texture(SAMPLER_2D(u_Texture), clamp(v_UV + u_TexSize.zw * delta.xy, vec2(0.0), vec2(1.0)));
  outputColor = color * 0.25;
}
`;
