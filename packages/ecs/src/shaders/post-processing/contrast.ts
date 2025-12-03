export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  float u_Contrast;
};

out vec4 outputColor;

void main() {
  outputColor = texture(SAMPLER_2D(u_Texture), v_Uv);
  if (u_Contrast > 0.0) {
    outputColor.rgb = (outputColor.rgb - 0.5) / (1.0 - u_Contrast) + 0.5;
  } else {
    outputColor.rgb = (outputColor.rgb - 0.5) * (1.0 + u_Contrast) + 0.5;
  }
}
`;
