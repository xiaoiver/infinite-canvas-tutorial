/**
 * Dual Kawase blur (4 taps), matching
 * {@link https://github.com/pixijs/filters/blob/main/src/kawase-blur/kawase-blur.frag Pixi kawase-blur.frag}.
 *
 * `u_Kawase0.xy` = UV offset; `u_Kawase0.z` = clamp enable (≥ 0.5); `u_Kawase1` = input clamp (min.xy, max.zw).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_Kawase0;
  vec4 u_Kawase1;
};

out vec4 outputColor;

void main() {
  vec2 uv = v_Uv;
  vec2 o = u_Kawase0.xy;
  bool useClamp = u_Kawase0.z >= 0.5;
  vec2 cmin = u_Kawase1.xy;
  vec2 cmax = u_Kawase1.zw;

  vec2 tl = vec2(uv.x - o.x, uv.y + o.y);
  vec2 tr = vec2(uv.x + o.x, uv.y + o.y);
  vec2 br = vec2(uv.x + o.x, uv.y - o.y);
  vec2 bl = vec2(uv.x - o.x, uv.y - o.y);

  if (useClamp) {
    tl = clamp(tl, cmin, cmax);
    tr = clamp(tr, cmin, cmax);
    br = clamp(br, cmin, cmax);
    bl = clamp(bl, cmin, cmax);
  }

  vec4 color = vec4(0.0);
  color += texture(SAMPLER_2D(u_Texture), tl);
  color += texture(SAMPLER_2D(u_Texture), tr);
  color += texture(SAMPLER_2D(u_Texture), br);
  color += texture(SAMPLER_2D(u_Texture), bl);
  outputColor = color * 0.25;
}
`;
