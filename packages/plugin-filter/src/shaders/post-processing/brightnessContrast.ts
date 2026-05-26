/**
 * Additive brightness + piecewise contrast, matching
 * {@link https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/brightnesscontrast.js glfx.js brightnessContrast}
 *
 * Uniforms (glfx semantics): brightness ∈ [-1, 1], contrast ∈ [-1, 1] (clamp contrast away from ±1 before CPU to avoid divide-by-zero).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_BrightnessContrast;
};

out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  float brightness = u_BrightnessContrast.x;
  float contrast = u_BrightnessContrast.y;

  if (color.a > 0.0) {
    color.rgb /= color.a;
    color.rgb += brightness;
    if (contrast > 0.0) {
      color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
    } else {
      color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
    }
    color.rgb *= color.a;
  }

  outputColor = color;
}
`;
