/** Bilinear sampling for straight-alpha filter outputs, including zoom/flip. */
export const straightAlphaSampling = /* glsl */ `
vec4 samplePremultipliedTexel(vec2 uv) {
  vec4 color = texture(SAMPLER_2D(u_Texture), uv);
  return vec4(color.rgb * color.a, color.a);
}

vec4 sampleStraightTexture(vec2 uv, vec2 size) {
  vec2 texel = 1.0 / max(ceil(size), vec2(1.0));
  vec2 pixel = uv / texel - 0.5;
  vec2 base = (floor(pixel) + 0.5) * texel;
  vec2 weight = fract(pixel);
  vec4 color = mix(
    mix(samplePremultipliedTexel(base), samplePremultipliedTexel(base + vec2(texel.x, 0.0)), weight.x),
    mix(samplePremultipliedTexel(base + vec2(0.0, texel.y)), samplePremultipliedTexel(base + texel), weight.x),
    weight.y
  );
  return color.a > 0.0 ? vec4(color.rgb / color.a, color.a) : vec4(0.0);
}
`;
