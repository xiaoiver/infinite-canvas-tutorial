/** Mist accumulation (One, One) and background mist compose (bg-mist.glsl). */
export const fragAccum = /* glsl */ `
layout(std140) uniform RainFxMistUniforms {
  vec4 u_Color;
};
out vec4 outputColor;

void main() {
  outputColor = u_Color;
}
`;

export const fragBg = /* glsl */ `
uniform sampler2D u_Texture;
uniform sampler2D u_MistTex;
layout(std140) uniform RainFxMistBgUniforms {
  vec4 u_MistColor;
};
in vec2 v_UV;
out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_UV).rgba;
  color.rgb += u_MistColor.rgb;
  color.a = texture(SAMPLER_2D(u_MistTex), v_UV).r * u_MistColor.a;
  outputColor = color;
}
`;
