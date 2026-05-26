/**
 * CMYK-style color halftone, matching
 * {@link https://github.com/evanw/glfx.js/blob/master/src/filters/fun/colorhalftone.js glfx colorHalftone}
 *
 * CPU passes `scale = π / size` (dot diameter `size` in pixels), `center` in pixels,
 * `texSize` = texture dimensions. Angle offsets 0.26179, 1.30899, 0.78539 rad are from glfx.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_CH0;
  vec4 u_CH1;
};

out vec4 outputColor;

float halftonePattern(float rotAngle) {
  float s = sin(rotAngle), c = cos(rotAngle);
  vec2 tex = v_Uv * u_CH1.xy - u_CH0.xy;
  vec2 point = vec2(
    c * tex.x - s * tex.y,
    s * tex.x + c * tex.y
  ) * u_CH0.w;
  return (sin(point.x) * sin(point.y)) * 4.0;
}

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  if (color.a > 0.0) {
    color.rgb /= color.a;
  }

  float baseAngle = u_CH0.z;
  vec3 cmy = 1.0 - color.rgb;
  float k = min(cmy.x, min(cmy.y, cmy.z));
  float denom = max(1.0 - k, 1e-5);
  cmy = (cmy - k) / denom;
  cmy = clamp(
    cmy * 10.0 - 3.0 + vec3(
      halftonePattern(baseAngle + 0.26179),
      halftonePattern(baseAngle + 1.30899),
      halftonePattern(baseAngle)
    ),
    0.0,
    1.0
  );
  k = clamp(k * 10.0 - 5.0 + halftonePattern(baseAngle + 0.78539), 0.0, 1.0);
  vec3 rgb = 1.0 - cmy - vec3(k);
  color.rgb = rgb * color.a;

  outputColor = color;
}
`;
