/**
 * Lens edge darkening: radial `smoothstep` from center.
 * `size` / `amount` ∈ [0, 1], clamped on CPU.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_Vignette;
};

out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  float size = u_Vignette.x;
  float amount = u_Vignette.y;
  float dist = distance(v_Uv, vec2(0.5, 0.5));
  float m = smoothstep(0.8, size * 0.799, dist * (amount + size));
  color.rgb *= m;
  outputColor = color;
}
`;
