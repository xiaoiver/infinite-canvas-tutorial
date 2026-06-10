/**
 * 3D mesh shader with metallic-roughness physically-based lighting.
 *
 * Direct lighting uses a Cook-Torrance microfacet BRDF (GGX/Trowbridge-Reitz
 * normal distribution, Smith geometry term, Schlick Fresnel) driven by the
 * material `metallic` and `roughness` parameters, mirroring three.js
 * `MeshStandardMaterial` / `MeshPhysicalMaterial`. The legacy
 * ambient/diffuse/specular/shininess fields are retained for uniform-buffer
 * layout compatibility: `ambient` still scales the ambient term and an optional
 * specular map still modulates the specular response.
 * Supports multiple ambient, directional, point, and spot lights.
 */

export const vert = /* glsl */ `
#define MAX_3D_LIGHTS 8

layout(std140) uniform SceneUniforms3D {
  mat4 u_ProjectionMatrix3D;
  mat4 u_ViewMatrix3D;
  mat4 u_CanvasViewProjection3D;
  // z=1: linked perspective; xyw = camera eye (canvas space) for lighting
  vec4 u_SceneParams;
  vec4 u_AmbientLight;
  vec4 u_LightCount;
  vec4 u_LightPositions[MAX_3D_LIGHTS];
  vec4 u_LightDirections[MAX_3D_LIGHTS];
  vec4 u_LightColors[MAX_3D_LIGHTS];
  vec4 u_LightParams3D[MAX_3D_LIGHTS];
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
  // x: metallic, y: roughness (PBR metallic-roughness workflow)
  vec4 u_PbrParams;
};

layout(location = 0) in vec3 a_Position3D;
layout(location = 1) in vec3 a_Normal3D;
layout(location = 2) in vec2 a_Uv3D;

out vec3 v_Normal;
out vec3 v_FragPos;
out vec2 v_Uv;

void main() {
  vec4 worldPos = u_ModelMatrix3D * vec4(a_Position3D, 1.0);
  v_FragPos = worldPos.xyz;
  v_Normal = (u_NormalMatrix3D * vec4(a_Normal3D, 0.0)).xyz;
  v_Uv = a_Uv3D;

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
  // x: metallic, y: roughness (PBR metallic-roughness workflow)
  vec4 u_PbrParams;
};

uniform sampler2D u_Map;
uniform sampler2D u_SpecularMap;
uniform sampler2D u_BumpMap;

in vec3 v_Normal;
in vec3 v_FragPos;
in vec2 v_Uv;

out vec4 outputColor;

#define PI 3.141592653589793

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
  vec3 viewDir;
  if (u_SceneParams.z > 0.5) {
    viewDir = normalize(
      vec3(u_SceneParams.x, u_SceneParams.y, u_SceneParams.w) - v_FragPos
    );
  } else {
    viewDir = normalize(-v_FragPos);
  }

  vec4 baseColor = u_BaseColor;
  if (u_MaterialFlags.x > 0.5) {
    baseColor *= texture(SAMPLER_2D(u_Map), v_Uv);
  }
  vec3 albedo = baseColor.rgb;

  float metallic = clamp(u_PbrParams.x, 0.0, 1.0);
  // Clamp roughness away from 0 to keep the specular lobe numerically stable.
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

  vec3 result = ambient + Lo;
  outputColor = vec4(result, baseColor.a);
}
`;
