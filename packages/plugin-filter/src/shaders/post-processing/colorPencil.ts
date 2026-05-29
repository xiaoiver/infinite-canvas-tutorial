/**
 * Color pencil sketch effect.
 *
 * Uses Sobel edge detection on the luminance channel, inverts the edges
 * to produce pencil-like strokes on a white background, and optionally
 * blends in the original color.
 *
 * `u_ColorPencil`:
 *   x = strength (edge intensity, 0–1)
 *   y = color mix (0 = grayscale sketch, 1 = full color tint)
 *
 * `u_InputSize.xy`: texture dimensions in pixels.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_ColorPencil;
  vec4 u_InputSize;
};

out vec4 outputColor;

float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 texel = 1.0 / u_InputSize.xy;
  float strength = u_ColorPencil.x;
  float colorMix = u_ColorPencil.y;

  // Sample 3x3 neighborhood luminance
  float tl = luminance(texture(SAMPLER_2D(u_Texture), v_Uv + vec2(-texel.x,  texel.y)).rgb);
  float t  = luminance(texture(SAMPLER_2D(u_Texture), v_Uv + vec2( 0.0,      texel.y)).rgb);
  float tr = luminance(texture(SAMPLER_2D(u_Texture), v_Uv + vec2( texel.x,  texel.y)).rgb);
  float l  = luminance(texture(SAMPLER_2D(u_Texture), v_Uv + vec2(-texel.x,  0.0)).rgb);
  float r  = luminance(texture(SAMPLER_2D(u_Texture), v_Uv + vec2( texel.x,  0.0)).rgb);
  float bl = luminance(texture(SAMPLER_2D(u_Texture), v_Uv + vec2(-texel.x, -texel.y)).rgb);
  float b  = luminance(texture(SAMPLER_2D(u_Texture), v_Uv + vec2( 0.0,     -texel.y)).rgb);
  float br = luminance(texture(SAMPLER_2D(u_Texture), v_Uv + vec2( texel.x, -texel.y)).rgb);

  // Sobel operator
  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
  float edge = length(vec2(gx, gy));

  // Pencil stroke: invert edges on white background
  float pencil = 1.0 - edge * strength * 3.0;
  pencil = clamp(pencil, 0.0, 1.0);

  // Original color sample
  vec4 original = texture(SAMPLER_2D(u_Texture), v_Uv);
  vec3 originalRGB = original.rgb;
  if (original.a > 0.0) {
    originalRGB /= original.a;
  }

  // Blend: grayscale sketch with optional color tint
  vec3 sketch = vec3(pencil);
  vec3 colored = originalRGB * pencil;
  vec3 result = mix(sketch, colored, colorMix);

  outputColor = vec4(result * original.a, original.a);
}
`;
