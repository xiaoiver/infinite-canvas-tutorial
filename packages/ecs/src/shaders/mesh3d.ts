/**
 * 3D mesh shader with metallic-roughness physically-based lighting.
 *
 * Direct lighting uses a Cook-Torrance microfacet BRDF (GGX/Trowbridge-Reitz
 * normal distribution, Smith geometry term, Schlick Fresnel) driven by the
 * material `metallic` and `roughness` parameters. Ambient is a simple fill,
 * with optional equirectangular diffuse light and reflections. The legacy
 * ambient/diffuse/specular/shininess fields are retained for uniform-buffer
 * layout compatibility: `ambient` still scales the ambient term and an optional
 * specular map still modulates the specular response. The first directional
 * or spot light with castShadow uses a packed-depth shadow map with 3x3 PCF.
 * Supports multiple ambient, directional, point, and spot lights.
 */

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
  mat4 u_ShadowViewProjection;
  vec4 u_ShadowParams; // x: shadowed light index + 1, y: shadow-map texel size
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
  mat4 u_ShadowViewProjection;
  vec4 u_ShadowParams;
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
};

uniform sampler2D u_Map;
uniform sampler2D u_SpecularMap;
uniform sampler2D u_BumpMap;
uniform sampler2D u_EnvironmentMap;
uniform sampler2D u_ShadowMap;

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

float distanceAttenuation(float distanceToLight, float range) {
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

vec3 sampleEnvironment(vec3 direction) {
  vec3 d = normalize(direction);
  vec2 uv = vec2(atan(d.z, d.x) / (2.0 * PI) + 0.5,
    asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
  return srgbToLinear(texture(SAMPLER_2D(u_EnvironmentMap), uv).rgb);
}

// A small angular filter softens reflections on rough materials. This accepts
// ordinary LDR panoramas without requiring prefiltered mipmaps from the loader.
vec3 environmentReflection(vec3 reflected, float roughness) {
  vec3 axis = abs(reflected.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(reflected, axis));
  vec3 bitangent = cross(reflected, tangent);
  float spread = roughness * roughness * 0.9;
  vec3 result = sampleEnvironment(reflected) * 0.4;
  result += sampleEnvironment(reflected + spread * tangent) * 0.15;
  result += sampleEnvironment(reflected - spread * tangent) * 0.15;
  result += sampleEnvironment(reflected + spread * bitangent) * 0.15;
  result += sampleEnvironment(reflected - spread * bitangent) * 0.15;
  return result;
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

float shadowVisibility(vec3 position, vec3 normal, vec3 lightDir, bool spot) {
  vec4 clip = u_ShadowViewProjection * vec4(position, 1.0);
  vec3 projected = clip.xyz / clip.w;
  vec2 uv = projected.xy * 0.5 + 0.5;
  float depth = projected.z * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ||
      depth < 0.0 || depth > 1.0) return 1.0;
  // Color-packed depth has a small raster/texel mismatch, amplified across the
  // 3x3 kernel on surfaces oblique to the light. Offset receivers enough to
  // avoid self-shadow stripes while retaining the much larger caster gap.
  float slope = 1.0 - max(dot(normal, lightDir), 0.0);
  float bias = spot ? max(0.004, 0.006 * slope)
    : max(0.005, 0.008 * slope);
  float visibility = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 sampleUv = uv + vec2(float(x), float(y)) * u_ShadowParams.y;
      float stored = unpackShadowDepth(texture(SAMPLER_2D(u_ShadowMap), sampleUv));
      visibility += depth - bias <= stored ? 1.0 : 0.0;
    }
  }
  return visibility / 9.0;
}

// Cook-Torrance microfacet BRDF for a single analytic light.
vec3 shadeLight(
  int index,
  vec3 normal,
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
  float range = params.z;
  float cosInner = params.w;
  float cosOuter = u_LightDirections[index].w;
  vec3 lightColor = u_LightColors[index].rgb * intensity;
  vec3 lightDir = vec3(0.0, 0.0, 1.0);
  float attenuation = 1.0;

  if (lightType == LIGHT_TYPE_DIRECTIONAL) {
    lightDir = normalize(-u_LightDirections[index].xyz);
    if (u_ShadowParams.x > 0.5 && index == int(u_ShadowParams.x) - 1)
      attenuation *= shadowVisibility(v_FragPos, normal, lightDir, false);
  } else {
    vec3 toLight = u_LightPositions[index].xyz - v_FragPos;
    float distanceToLight = length(toLight);
    if (distanceToLight > 1e-6) {
      lightDir = toLight / distanceToLight;
    }
    attenuation *= distanceAttenuation(distanceToLight, range);

    if (lightType == LIGHT_TYPE_SPOT) {
      vec3 spotDirection = normalize(u_LightDirections[index].xyz);
      float spotCos = dot(-lightDir, spotDirection);
      float cone = smoothstep(cosOuter, cosInner, spotCos);
      attenuation *= cone;
      if (u_ShadowParams.x > 0.5 && index == int(u_ShadowParams.x) - 1)
        attenuation *= shadowVisibility(v_FragPos, normal, lightDir, true);
    }
  }

  vec3 halfDir = normalize(lightDir + viewDir);
  float NdotL = max(dot(normal, lightDir), 0.0);
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
  vec3 dp1 = dFdx(v_FragPos);
  vec3 dp2 = dFdy(v_FragPos);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, normal);
  vec3 dp1perp = cross(normal, dp1);
  vec3 tangent = dp1perp * duv2.x + dp2perp * duv1.x;
  vec3 bitangent = dp1perp * duv2.y + dp2perp * duv1.y;
  float maxLen = max(dot(tangent, tangent), dot(bitangent, bitangent));
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
  vec3 normal = normalize(v_Normal);
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
    vec3 fresnel = fresnelSchlick(max(dot(normal, viewDir), 0.0), F0);
    vec3 diffuseWeight = (vec3(1.0) - fresnel) * (1.0 - metallic);
    ambient *= diffuseWeight;
    ambient += environmentDiffuse(normal) * albedo * diffuseWeight * u_LightParams.x;
    vec3 reflected = reflect(-viewDir, normal);
    vec3 env = environmentReflection(reflected, roughness);
    ambient += env * fresnel * specularScale * u_LightParams.x;
  }

  vec3 result = ambient + Lo;
  outputColor = vec4(linearToSrgb(toneMapACES(result)), baseColor.a);
}
`;
