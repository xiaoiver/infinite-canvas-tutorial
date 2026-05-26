/**
 * Burn edge (noise threshold + screen-space radial) with optional pre-sample UV wave distortion
 * and chromatic dispersion. Single pass merges the former two-stage ref + burn flow.
 * Uniforms: {@link burnUniformValues} → `u_BR0`…`u_BR3`.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_BR0;
  vec4 u_BR1;
  vec4 u_BR2;
  vec4 u_BR3;
};

out vec4 outputColor;

vec2 hashBr(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noiseBr(vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hashBr(i + 0.0)), dot(b, hashBr(i + o)), dot(c, hashBr(i + 1.0)));
  return dot(n, vec3(70.0));
}

vec3 sRGBToLinearBr(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(2.2));
}

vec3 linearTosRGBBr(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
}

vec3 getDispersedColor(sampler2D tex, vec2 uv, vec2 direction, float strength) {
  float dispersionR = strength * 0.5;
  float dispersionG = strength * 0.0;
  float dispersionB = strength * -0.5;
  float r = texture(SAMPLER_2D(tex), uv + direction * dispersionR).r;
  float g = texture(SAMPLER_2D(tex), uv + direction * dispersionG).g;
  float b = texture(SAMPLER_2D(tex), uv + direction * dispersionB).b;
  return vec3(r, g, b);
}

/** Radial + sine UV warp (legacy first pass). uDistortion = 0 → identity. */
vec2 burnWarpUv(vec2 vUv, float uDistortion) {
  vec2 centeredCoord = vUv * 2.0 - 1.0;
  float distC = length(centeredCoord);
  float radialDistortion = uDistortion * 0.3 * distC;
  float waveFrequency = 3.0 + uDistortion * 2.0;
  float waveAmplitude = 0.08 * abs(uDistortion);
  float sineDistortion = sin(centeredCoord.y * waveFrequency + centeredCoord.x * 1.5) *
    waveAmplitude * (1.0 - distC * 0.7);
  vec2 dir = distC > 1e-4 ? centeredCoord / distC : vec2(1.0, 0.0);
  vec2 distortionVector = dir * radialDistortion;
  distortionVector.x += sineDistortion;
  distortionVector.y += sineDistortion * 0.5;
  vec2 finalCoord = (centeredCoord + distortionVector) * 0.5 + 0.5;
  return clamp(finalCoord, 0.0, 1.0);
}

void main() {
  float uBurn = u_BR0.x;
  float uDensity = u_BR0.y;
  float uSoftness = u_BR0.z;
  float uDispersion = u_BR0.w;
  float uDistortion = u_BR1.x;
  bool uInvertMask = u_BR1.y > 0.5;
  bool uTransparent = u_BR1.z > 0.5;

  vec2 sceneUv = burnWarpUv(v_Uv, uDistortion);

  vec4 originalColor = texture(SAMPLER_2D(u_Texture), sceneUv);
  vec4 texColor = u_BR3;
  texColor.rgb = sRGBToLinearBr(texColor.rgb);

  vec2 center = vec2(0.5, 0.5);
  float dist = distance(v_Uv, center);
  float noiseFactor = noiseBr(v_Uv * 10.0 * uDensity) * 0.2;
  float burnThreshold = max(0.0, min(1.0, uBurn + uBurn * 0.1 + noiseFactor));
  float edgeWidth = max(0.0, uSoftness * 0.2);
  float innerEdge = burnThreshold;
  float outerEdge = burnThreshold + edgeWidth;
  float burnEdge = smoothstep(innerEdge, outerEdge, 1.0 - dist);
  burnEdge = uInvertMask ? burnEdge : 1.0 - burnEdge;

  vec3 dispersedColor = originalColor.rgb;
  if (uDispersion > 0.0) {
    vec2 toC = v_Uv - center;
    float dlen = length(toC);
    vec2 direction = dlen > 1e-4 ? toC / dlen : vec2(1.0, 0.0);
    float dispersionEdgeWidth = max(0.01, uSoftness * 0.3);
    float edgeMask = smoothstep(0.0, dispersionEdgeWidth, burnEdge);
    float dispersionStrength = uDispersion * 0.01 * edgeMask;
    if (dispersionStrength > 0.0) {
      dispersedColor = getDispersedColor(u_Texture, sceneUv, direction, dispersionStrength);
    }
  }

  vec4 edgeColorWithAlpha = u_BR2;
  edgeColorWithAlpha.rgb = sRGBToLinearBr(edgeColorWithAlpha.rgb);
  vec3 finalColor = mix(edgeColorWithAlpha.rgb, texColor.rgb, burnEdge);
  float maskAlpha = mix(0.0, texColor.a, burnEdge);
  maskAlpha *= edgeColorWithAlpha.a;
  if (burnEdge < 0.01) {
    maskAlpha = 0.0;
  }
  maskAlpha *= smoothstep(0.0, 0.1, 1.1);
  finalColor = linearTosRGBBr(finalColor);
  if (uTransparent) {
    vec3 blendedColor = dispersedColor;
    float finalAlpha = originalColor.a * (1.0 - maskAlpha);
    outputColor = vec4(blendedColor, finalAlpha);
  } else {
    vec3 blendedColor = mix(dispersedColor, finalColor, maskAlpha);
    outputColor = vec4(blendedColor, originalColor.a);
  }
}
`;
