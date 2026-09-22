/**
 * Rotational hue + multiplicative saturation, matching
 * {@link https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/huesaturation.js glfx.js hueSaturation}
 *
 * Uniforms (glfx semantics): hue ∈ [-1, 1] (±1 = ±180° around the grayscale axis),
 * saturation ∈ [-1, 1] (-1 gray, 0 no change, +1 max contrast in glfx’s positive branch).
 * CPU side clamps saturation away from 1 in the positive branch to avoid divide-by-zero.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_HueSaturation;
};

out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  float hue = u_HueSaturation.x;
  float saturation = u_HueSaturation.y;

  if (color.a > 0.0) {
    color.rgb /= color.a;

    float angle = hue * 3.14159265;
    float s = sin(angle), c = cos(angle);
    vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
    color.rgb = vec3(
      dot(color.rgb, weights.xyz),
      dot(color.rgb, weights.zxy),
      dot(color.rgb, weights.yzx)
    );

    float average = (color.r + color.g + color.b) / 3.0;
    if (saturation > 0.0) {
      color.rgb += (average - color.rgb) * (1.0 - 1.0 / (1.001 - saturation));
    } else {
      color.rgb += (average - color.rgb) * (-saturation);
    }

    color.rgb *= color.a;
  }

  outputColor = color;
}
`;
