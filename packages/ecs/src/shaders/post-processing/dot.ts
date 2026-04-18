/**
 * Halftone dot screen, matching
 * {@link https://github.com/pixijs/filters/blob/main/src/dot/dot.frag Pixi dot.frag}
 *
 * `u_Dot`: `x` = angle (radians, passed through like Pixi `uAngle`), `y` = `uScale`, `z` = grayscale flag (1 = on).
 * `u_InputSize.xy`: texture dimensions in pixels (same role as Pixi `uInputSize.xy`).
 *
 * @see {@link https://github.com/pixijs/filters/blob/main/src/dot/DotFilter.ts DotFilter} defaults: scale 1, angle 5, grayscale true.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_Dot;
  vec4 u_InputSize;
};

out vec4 outputColor;

float dotPattern() {
  float angle = u_Dot.x;
  float scale = u_Dot.y;
  float s = sin(angle), c = cos(angle);
  vec2 tex = v_Uv * u_InputSize.xy;
  vec2 point = vec2(
    c * tex.x - s * tex.y,
    s * tex.x + c * tex.y
  ) * scale;
  return (sin(point.x) * sin(point.y)) * 4.0;
}

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  float useGray = u_Dot.z;

  if (color.a > 0.0) {
    color.rgb /= color.a;
  }

  vec3 colorRGB = color.rgb;
  if (useGray > 0.5) {
    colorRGB = vec3(colorRGB.r + colorRGB.g + colorRGB.b) / 3.0;
  }

  colorRGB = colorRGB * 10.0 - 5.0 + dotPattern();
  color.rgb = colorRGB * color.a;

  outputColor = color;
}
`;
