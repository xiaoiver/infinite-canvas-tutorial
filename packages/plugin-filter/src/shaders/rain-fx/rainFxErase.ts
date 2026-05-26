/** Erase raindrops from droplet/mist layers (raindrop-fx erase.glsl). */
export const frag = /* glsl */ `
uniform sampler2D u_Texture;
layout(std140) uniform RainFxEraseUniforms {
  vec2 u_EraserSmooth;
};
in vec2 v_UV;
out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_UV).rgba;
  color.a = smoothstep(u_EraserSmooth.x, u_EraserSmooth.y, color.a);
  outputColor = color;
}
`;
