/**
 * Tsunami: ribbed glass refraction with optional chromatic separation, drift, and highlights.
 * Ported from a three-pass style fragment; post-process uses `v_Uv` and {@link tsunamiUniformValues} → `u_TS0`–`u_TS3`.
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_TS0;
  vec4 u_TS1;
  vec4 u_TS2;
  vec4 u_TS3;
};

out vec4 outputColor;

#define PI 3.14159265358979323846

float randomTs(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec2 rotate2DTs(vec2 position, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  mat2 rotationMatrix = mat2(c, -s, s, c);
  return rotationMatrix * position;
}

void main() {
  float uStripeCount = u_TS0.z;
  float uStripeAngle = u_TS0.w;
  float uDistortion = u_TS1.x;
  float uReflection = u_TS1.y;
  float uDisturbance = u_TS1.z;
  float uContortion = u_TS1.w;
  float uBlend = u_TS2.x;
  float uDispersion = u_TS2.y;
  float uDrift = u_TS2.z;
  float uShadowIntensity = u_TS2.w;
  float uOffset = u_TS3.x;

  vec2 textureCoord = v_Uv;

  vec2 centeredUv = textureCoord - 0.5;
  vec2 rotatedUv = rotate2DTs(centeredUv, uStripeAngle);
  rotatedUv += 0.5;

  float sWaveOffset = sin(rotatedUv.y * PI * 2.0) * uContortion * 0.2;
  rotatedUv.x += sWaveOffset;

  rotatedUv.x += uOffset;

  float adjustedStripeCount = uStripeCount;

  if (uDisturbance > 0.0) {
    float disturbancePattern = sin(rotatedUv.x * uStripeCount * 0.7) *
      cos(rotatedUv.x * uStripeCount * 1.3) *
      sin(rotatedUv.x * uStripeCount * 2.1);
    float widthVariation = 1.0 + disturbancePattern * uDisturbance * 0.08;
    adjustedStripeCount *= widthVariation;
  }

  float stripeIndex = floor(rotatedUv.x * adjustedStripeCount);
  float stripePosition = fract(rotatedUv.x * adjustedStripeCount);

  float randomOffset = (randomTs(vec2(stripeIndex, 0.0)) - 0.5) * 2.0;

  float bulge = sin(stripePosition * PI * 2.0) * uDistortion;

  vec2 refractionBase = vec2(bulge * 0.1, 0.0);
  vec2 refractionOffset = rotate2DTs(refractionBase, uStripeAngle);

  float sInfluence = sin(textureCoord.y * PI * 2.0) * uContortion;
  refractionOffset.x += sInfluence * bulge * 0.05;

  vec2 distortedUv = textureCoord + refractionOffset;

  vec2 shiftBase = vec2(randomOffset * bulge * 0.02, 0.0);
  vec2 rotatedShift = rotate2DTs(shiftBase, uStripeAngle);
  distortedUv += rotatedShift;

  float absDrift = abs(uDrift);
  float driftDirection = sign(uDrift);

  float discontinuityIntensity = 0.0;
  float driftInfluence = 0.0;

  if (uDrift > 0.0) {
    float discontinuityStart = 1.0 - absDrift;
    discontinuityIntensity = smoothstep(discontinuityStart, 1.0, stripePosition) * 0.01 * absDrift * 5.0;
    driftInfluence = smoothstep(discontinuityStart, 1.0, stripePosition) * absDrift;
  } else if (uDrift < 0.0) {
    float discontinuityEnd = absDrift;
    discontinuityIntensity = smoothstep(discontinuityEnd, 0.0, stripePosition) * 0.01 * absDrift * 5.0;
    driftInfluence = smoothstep(discontinuityEnd, 0.0, stripePosition) * absDrift;
  }

  vec2 discontinuityOffset = rotate2DTs(vec2(discontinuityIntensity * driftDirection, 0.0), uStripeAngle);
  distortedUv += discontinuityOffset;

  vec4 textureColor;

  if (uDispersion > 0.0) {
    float dispersionInfluenceFactor = 1.0;
    vec2 baseDispersionOffset = vec2(0.0);

    if (uDistortion > 0.0 && uDrift != 0.0) {
      float bulgeInfluence = abs(bulge) * uDistortion;
      float combinedDriftFactor = 1.0 + (driftInfluence * bulgeInfluence);
      dispersionInfluenceFactor = combinedDriftFactor;
      baseDispersionOffset = refractionOffset;
    } else if (uDistortion == 0.0 && uDrift != 0.0) {
      dispersionInfluenceFactor = 1.0 + (driftInfluence * 2.0);
      vec2 driftDispersionBase = vec2(discontinuityIntensity * driftDirection * 0.8, 0.0);
      baseDispersionOffset = rotate2DTs(driftDispersionBase, uStripeAngle);
    } else if (uDistortion != 0.0 && uDrift == 0.0) {
      float bulgeInfluence = abs(bulge) * uDistortion;
      dispersionInfluenceFactor = 1.0 + bulgeInfluence;
      baseDispersionOffset = refractionOffset;
    } else {
      dispersionInfluenceFactor = 1.0;
      baseDispersionOffset = vec2(0.0, 0.0);
    }

    float adjustedDispersion = uDispersion * dispersionInfluenceFactor;

    vec2 dispersionSeparation = baseDispersionOffset * adjustedDispersion * 0.5;

    vec2 redOffset = dispersionSeparation;
    vec4 redSample = texture(SAMPLER_2D(u_Texture), distortedUv - redOffset);

    vec4 greenSample = texture(SAMPLER_2D(u_Texture), distortedUv);

    vec2 blueOffset = dispersionSeparation;
    vec4 blueSample = texture(SAMPLER_2D(u_Texture), distortedUv + blueOffset);

    textureColor = vec4(redSample.r, greenSample.g, blueSample.b, greenSample.a);
  } else {
    textureColor = texture(SAMPLER_2D(u_Texture), distortedUv);
  }

  float luminance = dot(textureColor.rgb, vec3(0.299, 0.587, 0.114));

  float reflectionInfluenceFactor = 1.0;
  float baseHighlightValue = 0.0;

  if (uDistortion > 0.0 && uDrift != 0.0) {
    float bulgeInfluence = abs(bulge) * uDistortion;
    float combinedDriftFactor = 1.0 + (driftInfluence * bulgeInfluence * 2.0);
    reflectionInfluenceFactor = combinedDriftFactor;
    baseHighlightValue = pow(abs(bulge), 3.0);
  } else if (uDistortion == 0.0 && uDrift != 0.0) {
    reflectionInfluenceFactor = 1.0 + (driftInfluence * 2.0);
    baseHighlightValue = pow(driftInfluence, 2.0);
  } else if (uDistortion != 0.0 && uDrift == 0.0) {
    float bulgeInfluence = abs(bulge) * uDistortion;
    reflectionInfluenceFactor = 1.0 + (bulgeInfluence * 2.0);
    baseHighlightValue = pow(abs(bulge), 3.0);
  } else {
    reflectionInfluenceFactor = 1.0;
    baseHighlightValue = 0.0;
  }

  float adjustedReflection = uReflection * reflectionInfluenceFactor;
  float baseHighlightIntensity = baseHighlightValue * adjustedReflection;

  float blendValue = uBlend;
  float brightnessMultiplier = mix(1.0, luminance * 2.0, blendValue);
  float finalHighlightIntensity = baseHighlightIntensity * brightnessMultiplier;

  textureColor.rgb += vec3(finalHighlightIntensity);

  if (abs(uDrift) > 0.0) {
    float shadowStrength = driftInfluence * 0.3;

    float shadowGradient = 1.0;
    if (uDrift > 0.0) {
      shadowGradient = smoothstep(0.0, 1.0, stripePosition);
    } else if (uDrift < 0.0) {
      shadowGradient = smoothstep(1.0, 0.0, stripePosition);
    }

    float shadowEffect = shadowStrength * shadowGradient * uShadowIntensity;
    textureColor.rgb *= (1.0 - shadowEffect);
  }

  outputColor = vec4(textureColor.rgb, textureColor.a);
}
`;
