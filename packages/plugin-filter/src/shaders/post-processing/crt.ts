/**
 * CRT scanlines only (no vignette — use a separate `vignette()` pass).
 * Based on {@link https://github.com/pixijs/filters/blob/main/src/crt/crt.frag Pixi crt.frag} (minus noise & vignette).
 *
 * `u_CRT1.w` = animation time for scanlines; `u_CRT2` = input/output extent in pixels (`xy` size, `zw` same).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_CRT0;
  vec4 u_CRT1;
  vec4 u_CRT2;
};

out vec4 outputColor;

// Scales engine time in the scanline phase (higher = faster band drift; time is ~seconds).
const float CRT_SCANLINE_TIME_SCALE = 3.0;

vec3 interlaceLines(vec3 co, vec2 coord) {
  vec3 color = co;

  float curvature = u_CRT0.x;
  float lineWidth = u_CRT0.y;
  float lineContrast = u_CRT0.z;
  float verticalLine = u_CRT0.w;

  vec2 dir = coord * u_CRT2.xy / u_CRT2.zw - vec2(0.5);

  float _c = curvature > 0. ? curvature : 1.;
  float k = curvature > 0. ? (length(dir * dir) * 0.25 * _c * _c + 0.935 * _c) : 1.;
  vec2 uv = dir * k;
  float v = verticalLine > 0.5 ? uv.x * u_CRT2.z : uv.y * u_CRT2.w;
  v *= min(1.0, 2.0 / lineWidth) / _c;
  float j =
    1.0
    + cos(v * 1.2 - u_CRT1.w * CRT_SCANLINE_TIME_SCALE) * 0.5 * lineContrast;
  color *= j;

  float segment = verticalLine > 0.5
    ? mod((dir.x + .5) * u_CRT2.z, 4.)
    : mod((dir.y + .5) * u_CRT2.w, 4.);
  color *= 0.99 + ceil(segment) * 0.015;

  return color;
}

void main(void) {
  outputColor = texture(SAMPLER_2D(u_Texture), v_Uv);
  vec2 coord = v_Uv * u_CRT2.xy / u_CRT2.zw;

  if (u_CRT0.y > 0.0) {
    outputColor = vec4(interlaceLines(outputColor.rgb, v_Uv), outputColor.a);
  }
}
`;
