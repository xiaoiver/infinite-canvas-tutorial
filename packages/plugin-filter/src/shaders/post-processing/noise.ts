import { random } from '../chunks/random';

/**
 * @see https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/noise.js
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  float u_Noise;
};

out vec4 outputColor;

${random}

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);

  float u_Seed = 12345.0;

  float randomValue = random(v_Uv * u_Seed);
  float diff = (randomValue - 0.5) * u_Noise;

  if (color.a > 0.0) {
    color.rgb /= color.a;
  }

  color.r += diff;
  color.g += diff;
  color.b += diff;

  // Premultiply alpha again.
  color.rgb *= color.a;

  outputColor = color;
}
`;
