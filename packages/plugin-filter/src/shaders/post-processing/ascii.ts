/**
 * Pixi {@link https://github.com/pixijs/filters/blob/main/src/ascii/ascii.frag ascii.frag}
 * — bitmap font-style ASCII art from luminance.
 *
 * Uniforms: `u_ASCII0` = (cell size px, replaceColor 0/1, color.r, color.g), `u_ASCII1.x` = color.b,
 * `u_InputSizeAscii` = (texture width, height, 0, 0) in pixels (same convention as {@link pixelate}).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_ASCII0;
  vec4 u_ASCII1;
  vec4 u_InputSizeAscii;
};

out vec4 outputColor;

vec2 mapCoord(vec2 uv) {
  vec2 coord = uv * u_InputSizeAscii.xy;
  coord += u_InputSizeAscii.zw;
  return coord;
}

vec2 unmapCoord(vec2 coord) {
  coord -= u_InputSizeAscii.zw;
  coord /= u_InputSizeAscii.xy;
  return coord;
}

vec2 pixelateBlock(vec2 coord, vec2 size) {
  return floor(coord / size) * size;
}

vec2 getMod(vec2 coord, vec2 size) {
  return mod(coord, size) / size;
}

float character(float n, vec2 p) {
  p = floor(p * vec2(4.0, 4.0) + 2.5);
  if (clamp(p.x, 0.0, 4.0) == p.x) {
    if (clamp(p.y, 0.0, 4.0) == p.y) {
      if (int(mod(n / exp2(p.x + 5.0 * p.y), 2.0)) == 1) {
        return 1.0;
      }
    }
  }
  return 0.0;
}

void main() {
  float uSize = u_ASCII0.x;
  float uReplaceColor = u_ASCII0.y;
  vec3 uColor = vec3(u_ASCII0.z, u_ASCII0.w, u_ASCII1.x);

  vec2 coord = mapCoord(v_Uv);
  vec2 pixCoord = pixelateBlock(coord, vec2(uSize));
  pixCoord = unmapCoord(pixCoord);

  vec4 color = texture(SAMPLER_2D(u_Texture), pixCoord);
  float gray = 0.3 * color.r + 0.59 * color.g + 0.11 * color.b;

  float n = 65536.0;
  if (gray > 0.2) n = 65600.0;
  if (gray > 0.3) n = 332772.0;
  if (gray > 0.4) n = 15255086.0;
  if (gray > 0.5) n = 23385164.0;
  if (gray > 0.6) n = 15252014.0;
  if (gray > 0.7) n = 13199452.0;
  if (gray > 0.8) n = 11512810.0;

  vec2 modd = getMod(coord, vec2(uSize));
  vec4 glyph = (uReplaceColor > 0.5 ? vec4(uColor, 1.0) : color)
    * character(n, vec2(-1.0) + modd * 2.0);
  outputColor = glyph;
}
`;
