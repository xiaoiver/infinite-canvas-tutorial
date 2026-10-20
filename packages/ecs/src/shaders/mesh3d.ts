/**
 * 3D mesh shader with metallic-roughness physically-based lighting.
 *
 * Direct lighting uses a Cook-Torrance microfacet BRDF (GGX/Trowbridge-Reitz
 * normal distribution, Smith geometry term, Schlick Fresnel) driven by the
 * material `metallic` and `roughness` parameters. Ambient is a simple fill,
 * with optional equirectangular diffuse light and reflections. The legacy
 * ambient/diffuse/specular/shininess fields are retained for uniform-buffer
 * layout compatibility: `ambient` still scales the ambient term and an optional
 * specular map still modulates the specular response. Up to two directional,
 * spot, or point lights with castShadow use packed-depth maps with 3x3 PCF.
 * Supports multiple ambient, directional, point, and spot lights.
 */

import { POINT_SHADOW_FACES } from '../utils/geometry3d/point-shadow-faces';

const pointShadowAxes = (axis: 'right' | 'up') =>
  POINT_SHADOW_FACES.map(
    (face, index) =>
      `${index ? 'else ' : ''}if (face == ${index}) return vec3(${face[axis]
        .map((value) => value.toFixed(1))
        .join(', ')});`,
  ).join('\n  ');

export const vert = /* glsl */ `
#define MAX_3D_LIGHTS 8

layout(std140) uniform SceneUniforms3D {
  mat4 u_ProjectionMatrix3D;
  mat4 u_ViewMatrix3D;
  mat4 u_CanvasViewProjection3D;
  // z=1: linked perspective, z=-1: orthographic; xyw = effective eye or view direction
  vec4 u_SceneParams; // xyw: eye or view direction; z: projection mode
  vec4 u_AmbientLight;
  vec4 u_LightCount;
  vec4 u_LightPositions[MAX_3D_LIGHTS];
  vec4 u_LightDirections[MAX_3D_LIGHTS];
  vec4 u_LightColors[MAX_3D_LIGHTS];
  vec4 u_LightParams3D[MAX_3D_LIGHTS];
  mat4 u_ShadowViewProjection[2];
  vec4 u_ShadowParams[2]; // x: light index + 1, y: shadow-map texel size, z: point
  mat4 u_ShadowFaces[12];
  vec4 u_ShadowOptions[2]; // x: strength, y: PCF radius, z: depth bias scale, w: normal bias
};

layout(std140) uniform ModelUniforms3D {
  mat4 u_ModelMatrix3D;
  mat4 u_NormalMatrix3D;
  vec4 u_BaseColor;
  vec4 u_LightParams; // x: ambient, y: diffuse, z: specular, w: shininess
  vec4 u_LightDirection; // deprecated: kept for uniform-buffer layout compatibility
  // xy: Transform3D.translation (perspective anchor on canvas)
  vec4 u_CanvasAnchor;
  // x: map, y: specularMap, z: bumpMap, w: bumpScale
  vec4 u_MaterialFlags;
  // x: metallic, y: roughness, z: side color, w: environment map ready
  vec4 u_PbrParams;
  vec4 u_SideColor;
  vec4 u_EnvironmentIrradiance[9];
  vec4 u_ShadowReceive; // x: receives shadows, y: alpha mode, z: cutoff
};

layout(location = 0) in vec3 a_Position3D;
layout(location = 1) in vec3 a_Normal3D;
layout(location = 2) in vec2 a_Uv3D;

out vec3 v_Normal;
out vec3 v_FragPos;
out vec2 v_Uv;
out float v_LocalNormalZ;

void main() {
  vec4 worldPos = u_ModelMatrix3D * vec4(a_Position3D, 1.0);
  v_FragPos = worldPos.xyz;
  v_Normal = (u_NormalMatrix3D * vec4(a_Normal3D, 0.0)).xyz;
  v_Uv = a_Uv3D;
  v_LocalNormalZ = a_Normal3D.z;

  if (u_SceneParams.z > 0.5) {
    // 2D VP: pan / zoom / Y-flip; perspective scales offsets from placement anchor.
    vec4 clip2d = u_CanvasViewProjection3D * vec4(worldPos.xy, 0.0, 1.0);
    vec4 anchor2d = u_CanvasViewProjection3D *
      vec4(u_CanvasAnchor.xy, 0.0, 1.0);
    vec4 viewPos = u_ViewMatrix3D * worldPos;
    vec4 clipP = u_ProjectionMatrix3D * viewPos;
    vec4 viewRef = u_ViewMatrix3D *
      vec4(worldPos.x, worldPos.y, u_CanvasAnchor.z, 1.0);
    float clipPwRef = (u_ProjectionMatrix3D * viewRef).w;
    float pw = clipP.w;
    if (abs(pw) < 1e-6) {
      pw = pw >= 0.0 ? 1e-6 : -1e-6;
    }
    // Canvas z+ points into the screen; nearer faces have larger pw.
    float scale = pw / clipPwRef;
    gl_Position.xy = anchor2d.xy + (clip2d.xy - anchor2d.xy) * scale;
    gl_Position.z = clipP.z * clip2d.w / pw;
    gl_Position.w = clip2d.w;
  } else {
    gl_Position = u_ProjectionMatrix3D * u_ViewMatrix3D * worldPos;
  }
}
`;

export const frag = /* glsl */ `
#define MAX_3D_LIGHTS 8
#define LIGHT_TYPE_DIRECTIONAL 1
#define LIGHT_TYPE_POINT 2
#define LIGHT_TYPE_SPOT 3

// Order must match vert (WebGPU assigns UBO bindings by declaration order per stage).
layout(std140) uniform SceneUniforms3D {
  mat4 u_ProjectionMatrix3D;
  mat4 u_ViewMatrix3D;
  mat4 u_CanvasViewProjection3D;
  vec4 u_SceneParams;
  vec4 u_AmbientLight;
  vec4 u_LightCount;
  vec4 u_LightPositions[MAX_3D_LIGHTS];
  vec4 u_LightDirections[MAX_3D_LIGHTS];
  vec4 u_LightColors[MAX_3D_LIGHTS];
  vec4 u_LightParams3D[MAX_3D_LIGHTS];
  mat4 u_ShadowViewProjection[2];
  vec4 u_ShadowParams[2];
  mat4 u_ShadowFaces[12];
  vec4 u_ShadowOptions[2];
};

layout(std140) uniform ModelUniforms3D {
  mat4 u_ModelMatrix3D;
  mat4 u_NormalMatrix3D;
  vec4 u_BaseColor;
  vec4 u_LightParams; // x: ambient, y: diffuse, z: specular, w: shininess
  vec4 u_LightDirection; // deprecated: kept for uniform-buffer layout compatibility
  // xy: Transform3D.translation (perspective anchor on canvas)
  vec4 u_CanvasAnchor;
  // x: map, y: specularMap, z: bumpMap, w: bumpScale
  vec4 u_MaterialFlags;
  // x: metallic, y: roughness, z: side color, w: environment map ready
  vec4 u_PbrParams;
  vec4 u_SideColor;
  vec4 u_EnvironmentIrradiance[9];
  vec4 u_ShadowReceive; // x: receives shadows, y: alpha mode, z: cutoff
};

uniform sampler2D u_Map;
uniform sampler2D u_SpecularMap;
uniform sampler2D u_BumpMap;
uniform sampler2D u_EnvironmentMap;
uniform sampler2D u_ShadowMap0;
uniform sampler2D u_ShadowMap1;
uniform sampler2D u_EnvironmentBrdf;

in vec3 v_Normal;
in vec3 v_FragPos;
in vec2 v_Uv;
in float v_LocalNormalZ;

out vec4 outputColor;

#define PI 3.141592653589793

// CSS colors and image pixels are sRGB, while the lighting calculation is
// linear. The shared 2D/3D render target is RGBA8 UNORM, so it does not perform
// the final sRGB encoding for us.
vec3 srgbToLinear(vec3 color) {
  return mix(color / 12.92, pow((color + 0.055) / 1.055, vec3(2.4)),
    step(vec3(0.04045), color));
}

vec3 linearToSrgb(vec3 color) {
  return mix(color * 12.92, 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), color));
}

// Filmic mapping keeps bright direct lights from clipping abruptly in RGBA8.
vec3 toneMapACES(vec3 color) {
  vec3 x = max(color, vec3(0.0)) * 0.8;
  return clamp((x * (2.51 * x + 0.03)) /
    (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float distanceAttenuation(float distanceToLight, float range,
  float referenceDistance) {
  if (referenceDistance > 0.0) {
    float boundedDistance = max(distanceToLight, referenceDistance * 0.1);
    float inverseSquare = pow(referenceDistance / boundedDistance, 2.0);
    if (range <= 0.0) return inverseSquare;
    float fraction = distanceToLight / range;
    float cutoff = max(1.0 - pow(fraction, 4.0), 0.0);
    return inverseSquare * cutoff * cutoff;
  }
  if (range <= 0.0) {
    return 1.0;
  }
  float factor = clamp(1.0 - distanceToLight / range, 0.0, 1.0);
  return factor * factor;
}

// GGX / Trowbridge-Reitz normal distribution function.
float distributionGGX(float NdotH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH2 = NdotH * NdotH;
  float denom = NdotH2 * (a2 - 1.0) + 1.0;
  denom = PI * denom * denom;
  return a2 / max(denom, 1e-6);
}

// Schlick-GGX geometry term (single direction) with direct-lighting k.
float geometrySchlickGGX(float NdotX, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return NdotX / (NdotX * (1.0 - k) + k);
}

// Smith geometry term combining view and light occlusion.
float geometrySmith(float NdotV, float NdotL, float roughness) {
  return geometrySchlickGGX(NdotV, roughness) *
    geometrySchlickGGX(NdotL, roughness);
}

// Schlick Fresnel approximation.
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) *
    pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 sampleEnvironment(vec3 direction, int level) {
  vec3 d = normalize(direction);
  vec2 uv = vec2(atan(d.z, d.x) / (2.0 * PI) + 0.5,
    asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
  float width = 128.0 / exp2(float(level));
  float height = width * 0.5;
  float top = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= level) break;
    top += 64.0 / exp2(float(i));
  }
  // The uploaded atlas is north-at-top; v=1 points to its top after flipY.
  vec2 atlasUv = vec2((uv.x * (width - 1.0) + 0.5) / 128.0,
    1.0 - (top + (1.0 - uv.y) * (height - 1.0) + 0.5) / 124.0);
  vec4 rgbm = texture(SAMPLER_2D(u_EnvironmentMap), atlasUv);
  return rgbm.rgb * rgbm.a * 16.0;
}

// Five importance-sampled GGX levels are stored in one atlas for WebGL/WebGPU.
vec3 environmentReflection(vec3 reflected, float roughness) {
  float lod = clamp(roughness, 0.0, 1.0) * 4.0;
  int low = int(floor(lod));
  int high = low < 4 ? low + 1 : 4;
  return mix(sampleEnvironment(reflected, low),
    sampleEnvironment(reflected, high), fract(lod));
}

// Second-order spherical harmonics convolved with the Lambert cosine kernel
// on the CPU. The same basis order is used in environment-irradiance.ts.
vec3 environmentDiffuse(vec3 n) {
  vec3 irradiance =
    u_EnvironmentIrradiance[0].rgb * 0.282095 +
    u_EnvironmentIrradiance[1].rgb * (0.488603 * n.y) +
    u_EnvironmentIrradiance[2].rgb * (0.488603 * n.z) +
    u_EnvironmentIrradiance[3].rgb * (0.488603 * n.x) +
    u_EnvironmentIrradiance[4].rgb * (1.092548 * n.x * n.y) +
    u_EnvironmentIrradiance[5].rgb * (1.092548 * n.y * n.z) +
    u_EnvironmentIrradiance[6].rgb * (0.315392 * (3.0 * n.z * n.z - 1.0)) +
    u_EnvironmentIrradiance[7].rgb * (1.092548 * n.x * n.z) +
    u_EnvironmentIrradiance[8].rgb * (0.546274 * (n.x * n.x - n.y * n.y));
  return max(irradiance, vec3(0.0));
}

float unpackShadowDepth(vec4 depthColor) {
  return dot(depthColor, vec4(1.0 / 16777216.0, 1.0 / 65536.0, 1.0 / 256.0, 1.0));
}

int pointShadowFace(vec3 ray) {
  vec3 a = abs(ray);
  if (a.x >= a.y && a.x >= a.z) return ray.x >= 0.0 ? 0 : 1;
  if (a.y >= a.z) return ray.y >= 0.0 ? 2 : 3;
  return ray.z >= 0.0 ? 4 : 5;
}

vec2 pointShadowTile(int face) {
  // GLSL ES 1.00 has no integer modulo or integer min overload.
  return vec2(float(face >= 3 ? face - 3 : face), float(face >= 3 ? 1 : 0));
}

vec3 pointShadowRight(int face) {
  ${pointShadowAxes('right')}
  return vec3(0.0);
}

vec3 pointShadowUp(int face) {
  ${pointShadowAxes('up')}
  return vec3(0.0);
}

float shadowVisibility(vec3 position, vec3 normal, vec3 lightDir,
  bool spot, int slot, int lightIndex) {
  vec4 shadowParams = u_ShadowParams[slot];
  vec4 shadowOptions = u_ShadowOptions[slot];
  vec3 receiver = position + normal * shadowOptions.w;
  bool point = shadowParams.z > 0.5;
  int face = 0;
  vec3 ray = vec3(0.0);
  float faceDistance = 0.0;
  if (point) {
    ray = receiver - u_LightPositions[lightIndex].xyz;
    faceDistance = max(max(abs(ray.x), abs(ray.y)), abs(ray.z));
    if (faceDistance < 1e-6) return 1.0;
    face = pointShadowFace(ray);
  }
  vec4 clip = (point ? u_ShadowFaces[slot * 6 + face] :
    u_ShadowViewProjection[slot]) * vec4(receiver, 1.0);
  vec3 projected = clip.xyz / clip.w;
  vec2 localUv = projected.xy * 0.5 + 0.5;
  float depth = projected.z * 0.5 + 0.5;
  if (localUv.x < 0.0 || localUv.x > 1.0 || localUv.y < 0.0 || localUv.y > 1.0 ||
      depth < 0.0 || depth > 1.0) return 1.0;
  // Color-packed depth has a small raster/texel mismatch, amplified across the
  // 3x3 kernel on surfaces oblique to the light. Offset receivers enough to
  // avoid self-shadow stripes while retaining the much larger caster gap.
  float slope = 1.0 - max(dot(normal, lightDir), 0.0);
  float bias = (spot ? max(0.004, 0.006 * slope) :
    point ? max(0.0005, 0.001 * slope) : max(0.005, 0.008 * slope)) *
    shadowOptions.z;
  if (shadowOptions.y <= 0.0) {
    // A zero-width PCF kernel samples the same texel nine times. Use one
    // lookup for hard shadows, including point-light atlas faces.
    vec2 sampleLocal = clamp(localUv,
      vec2(shadowParams.y * 0.5), vec2(1.0 - shadowParams.y * 0.5));
    vec2 sampleUv = point
      ? (sampleLocal + pointShadowTile(face)) / vec2(3.0, 2.0)
      : sampleLocal;
    float stored = slot == 0
      ? unpackShadowDepth(texture(SAMPLER_2D(u_ShadowMap0), sampleUv))
      : unpackShadowDepth(texture(SAMPLER_2D(u_ShadowMap1), sampleUv));
    float visible = depth - bias <= stored ? 1.0 : 0.0;
    return mix(1.0, visible, shadowOptions.x);
  }
  float visibility = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y)) * shadowParams.y * shadowOptions.y;
      vec2 sampleLocal = localUv + offset;
      int sampleFace = face;
      float sampleDepth = depth;
      bool outside = sampleLocal.x < 0.0 || sampleLocal.x > 1.0 ||
        sampleLocal.y < 0.0 || sampleLocal.y > 1.0;
      if (point && outside) {
        // Move the lookup ray by one face texel, then reproject taps that cross
        // a cube seam into the adjacent atlas tile instead of repeating an edge.
        vec3 sampleReceiver = receiver + 2.0 * faceDistance *
          (offset.x * pointShadowRight(face) + offset.y * pointShadowUp(face));
        sampleFace = pointShadowFace(sampleReceiver - u_LightPositions[lightIndex].xyz);
        vec4 sampleClip = u_ShadowFaces[slot * 6 + sampleFace] *
          vec4(sampleReceiver, 1.0);
        vec3 sampleProjected = sampleClip.xyz / sampleClip.w;
        sampleLocal = sampleProjected.xy * 0.5 + 0.5;
        sampleDepth = sampleProjected.z * 0.5 + 0.5;
        outside = sampleLocal.x < 0.0 || sampleLocal.x > 1.0 ||
          sampleLocal.y < 0.0 || sampleLocal.y > 1.0 ||
          sampleDepth < 0.0 || sampleDepth > 1.0;
      }
      if (outside) {
        visibility += 1.0;
        continue;
      }
      sampleLocal = clamp(sampleLocal,
        vec2(shadowParams.y * 0.5), vec2(1.0 - shadowParams.y * 0.5));
      vec2 sampleUv = point
        ? (sampleLocal + pointShadowTile(sampleFace)) / vec2(3.0, 2.0)
        : sampleLocal;
      float stored = slot == 0
        ? unpackShadowDepth(texture(SAMPLER_2D(u_ShadowMap0), sampleUv))
        : unpackShadowDepth(texture(SAMPLER_2D(u_ShadowMap1), sampleUv));
      visibility += sampleDepth - bias <= stored ? 1.0 : 0.0;
    }
  }
  return mix(1.0, visibility / 9.0, shadowOptions.x);
}

// Cook-Torrance microfacet BRDF for a single analytic light.
vec3 shadeLight(
  int index,
  vec3 normal,
  vec3 shadowNormal,
  vec3 viewDir,
  vec3 albedo,
  vec3 F0,
  float metallic,
  float roughness,
  float specularScale
) {
  vec4 params = u_LightParams3D[index];
  int lightType = int(params.x);
  float intensity = params.y;
  if (intensity <= 0.0) return vec3(0.0);
  float range = params.z;
  float cosInner = params.w;
  float cosOuter = u_LightDirections[index].w;
  vec3 lightColor = u_LightColors[index].rgb * intensity;
  vec3 lightDir = vec3(0.0, 0.0, 1.0);
  float attenuation = 1.0;

  if (lightType == LIGHT_TYPE_DIRECTIONAL) {
    lightDir = normalize(-u_LightDirections[index].xyz);
  } else {
    vec3 toLight = u_LightPositions[index].xyz - v_FragPos;
    float distanceToLight = length(toLight);
    if (distanceToLight > 1e-6) {
      lightDir = toLight / distanceToLight;
    }
    attenuation *= distanceAttenuation(distanceToLight, range,
      u_LightPositions[index].w);

    if (lightType == LIGHT_TYPE_SPOT) {
      vec3 spotDirection = normalize(u_LightDirections[index].xyz);
      float spotCos = dot(-lightDir, spotDirection);
      float cone = smoothstep(cosOuter, cosInner, spotCos);
      attenuation *= cone;
    }
  }
  float NdotL = max(dot(normal, lightDir), 0.0);
  // No direct contribution is possible outside the light's range or cone, or
  // on a surface facing away from it. Avoid the 3x3 shadow lookup there.
  if (attenuation <= 0.0 || NdotL <= 0.0) return vec3(0.0);
  int shadowSlot = -1;
  if (index == int(u_ShadowParams[0].x) - 1) shadowSlot = 0;
  else if (index == int(u_ShadowParams[1].x) - 1) shadowSlot = 1;
  if (shadowSlot >= 0 && u_ShadowReceive.x > 0.5) {
    attenuation *= shadowVisibility(v_FragPos, shadowNormal, lightDir,
      lightType == LIGHT_TYPE_SPOT, shadowSlot, index);
  }

  vec3 halfDir = normalize(lightDir + viewDir);
  float NdotV = max(dot(normal, viewDir), 0.0);
  float NdotH = max(dot(normal, halfDir), 0.0);
  float HdotV = max(dot(halfDir, viewDir), 0.0);

  vec3 radiance = lightColor * attenuation;

  float NDF = distributionGGX(NdotH, roughness);
  float G = geometrySmith(NdotV, NdotL, roughness);
  vec3 F = fresnelSchlick(HdotV, F0);

  vec3 numerator = NDF * G * F * specularScale;
  float denom = 4.0 * NdotV * NdotL + 1e-4;
  vec3 specular = numerator / denom;

  // Energy conservation: metals have no diffuse contribution.
  vec3 kD = (vec3(1.0) - F) * (1.0 - metallic);

  return (kD * albedo / PI + specular) * radiance * NdotL;
}

vec3 perturbNormalFromBumpMap(vec3 normal, vec2 uv, float bumpScale) {
  if (abs(bumpScale) < 1e-6) return normal;
  vec3 dp1 = dFdx(v_FragPos);
  vec3 dp2 = dFdy(v_FragPos);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, normal);
  vec3 dp1perp = cross(normal, dp1);
  vec3 tangent = dp1perp * duv2.x + dp2perp * duv1.x;
  vec3 bitangent = dp1perp * duv2.y + dp2perp * duv1.y;
  float maxLen = max(dot(tangent, tangent), dot(bitangent, bitangent));
  // glTF meshes without UVs use zero coordinates; their tangent basis cannot
  // be normalized. Keep the geometric normal instead of producing NaNs.
  if (!(maxLen > 0.0)) return normal;
  float invmax = inversesqrt(maxLen);
  tangent *= invmax;
  bitangent *= invmax;
  float height = texture(SAMPLER_2D(u_BumpMap), uv).r;
  float heightDx = texture(SAMPLER_2D(u_BumpMap), uv + duv1).r - height;
  float heightDy = texture(SAMPLER_2D(u_BumpMap), uv + duv2).r - height;
  return normalize(
    tangent * (-heightDx * bumpScale) +
    bitangent * (-heightDy * bumpScale) +
    normal
  );
}

void main() {
  vec3 shadowNormal = normalize(v_Normal);
  vec3 normal = shadowNormal;
  if (u_MaterialFlags.z > 0.5) {
    normal = perturbNormalFromBumpMap(normal, v_Uv, u_MaterialFlags.w);
  }
  vec3 cameraVector = vec3(u_SceneParams.x, u_SceneParams.y, u_SceneParams.w);
  vec3 viewDir = u_SceneParams.z < -0.5
    ? normalize(cameraVector)
    : normalize(cameraVector - v_FragPos);

  vec4 baseColor = u_BaseColor;
  if (u_PbrParams.z > 0.5 && abs(v_LocalNormalZ) < 1.0) {
    baseColor = u_SideColor;
  }
  vec3 albedo = srgbToLinear(baseColor.rgb);
  if (u_MaterialFlags.x > 0.5) {
    vec4 texel = texture(SAMPLER_2D(u_Map), v_Uv);
    albedo *= srgbToLinear(texel.rgb);
    baseColor.a *= texel.a;
  }
  if (u_ShadowReceive.y > 0.5 && u_ShadowReceive.y < 1.5 &&
      baseColor.a < u_ShadowReceive.z) discard;
  if (u_ShadowReceive.y < 1.5) baseColor.a = 1.0;

  float metallic = clamp(u_PbrParams.x, 0.0, 1.0);
  // Clamp roughness to a small minimum (0.04): at roughness 0 the GGX lobe
  // collapses to a delta, producing fireflies / division instabilities in the
  // analytic specular term, so we keep a tiny floor as is common in PBR shaders.
  float roughness = clamp(u_PbrParams.y, 0.04, 1.0);

  // Optional specular map modulates the microfacet specular response.
  float specularScale = 1.0;
  if (u_MaterialFlags.y > 0.5) {
    specularScale = dot(
      texture(SAMPLER_2D(u_SpecularMap), v_Uv).rgb,
      vec3(0.299, 0.587, 0.114)
    );
  }

  // Dielectrics reflect ~4% at normal incidence; metals tint reflectance with
  // the base color.
  vec3 F0 = mix(vec3(0.04), albedo, metallic);

  vec3 Lo = vec3(0.0);
  for (int i = 0; i < MAX_3D_LIGHTS; i++) {
    if (i >= int(u_LightCount.x)) {
      break;
    }
    Lo += shadeLight(
      i,
      normal,
      shadowNormal,
      viewDir,
      albedo,
      F0,
      metallic,
      roughness,
      specularScale
    );
  }

  // Ambient term (legacy ambient field acts as an ambient strength).
  vec3 ambient = u_AmbientLight.rgb * u_LightParams.x * albedo;
  if (u_PbrParams.w > 0.5) {
    // With a reflection source, metals receive ambient energy through their
    // specular response rather than a diffuse albedo fill.
    float nDotV = max(dot(normal, viewDir), 0.0);
    vec3 fresnel = fresnelSchlickRoughness(nDotV, F0, roughness);
    vec3 diffuseWeight = (vec3(1.0) - fresnel) * (1.0 - metallic);
    ambient *= diffuseWeight;
    ambient += environmentDiffuse(normal) * albedo * diffuseWeight * u_LightParams.x;
    vec3 reflected = reflect(-viewDir, normal);
    vec3 env = environmentReflection(reflected, roughness);
    vec2 brdf = texture(SAMPLER_2D(u_EnvironmentBrdf),
      vec2(nDotV, roughness)).rg;
    ambient += env * (F0 * brdf.x + brdf.y) * specularScale * u_LightParams.x;
  }

  vec3 result = ambient + Lo;
  outputColor = vec4(linearToSrgb(toneMapACES(result)), baseColor.a);
}
`;
