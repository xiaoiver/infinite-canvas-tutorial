export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

out vec4 outputColor;

void main() {
  outputColor = texture(SAMPLER_2D(u_Texture), v_Uv);
  // outputColor = vec4(v_Uv, 0.0, 1.0);
}
`;
