/**
 * Mosaic / block sampling in texture pixel space, matching
 * {@link https://github.com/pixijs/filters/blob/main/src/pixelate/pixelate.frag Pixi pixelate.frag}
 *
 * `u_Pixelate`: `xy` = block size in pixels (`uSize` in Pixi), `zw` = input texture size (`uInputSize.xy`;
 * subtexture offset `uInputSize.zw` is not used — full surface, zw = 0).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_Pixelate;
};

out vec4 outputColor;

vec2 mapCoord(vec2 uv) {
  return uv * u_Pixelate.zw;
}

vec2 unmapCoord(vec2 coord) {
  return coord / u_Pixelate.zw;
}

vec2 pixelateCoord(vec2 coord, vec2 block) {
  return floor(coord / block) * block;
}

void main() {
  vec2 coord = mapCoord(v_Uv);
  coord = pixelateCoord(coord, u_Pixelate.xy);
  vec2 uv = unmapCoord(coord);
  outputColor = texture(SAMPLER_2D(u_Texture), uv);
}
`;
