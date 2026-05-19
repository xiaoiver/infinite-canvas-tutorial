/** Cover-style blit (raindrop-fx Utils.imageResize Cover). */
export const frag = /* glsl */ `
uniform sampler2D u_Texture;
layout(std140) uniform RainFxBlitCoverUniforms {
  vec4 u_SrcRect;
};
in vec2 v_UV;
out vec4 outputColor;

void main() {
  vec2 uv = mix(u_SrcRect.xy, u_SrcRect.zw, v_UV);
  outputColor = texture(SAMPLER_2D(u_Texture), uv);
}
`;
