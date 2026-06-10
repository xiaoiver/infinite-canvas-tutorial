/**
 * Basic 3D mesh shader with Blinn-Phong lighting.
 * Supports multiple ambient, directional, point, and spot lights.
 */

export const vert = /* glsl */ `
#define MAX_3D_LIGHTS 8

layout(std140) uniform SceneUniforms3D {
  mat4 u_ProjectionMatrix3D;
  mat4 u_ViewMatrix3D;
  mat4 u_CanvasViewProjection3D;
  // z=1: linked perspective (2D VP + depth scale from anchor)
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
  // x: 1.0 when a base-color texture (u_Map) is bound, else 0.0
  vec4 u_MaterialFlags;
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
  // x: 1.0 when a base-color texture (u_Map) is bound, else 0.0
  vec4 u_MaterialFlags;
};

uniform sampler2D u_Map;

in vec3 v_Normal;
in vec3 v_FragPos;
in vec2 v_Uv;

out vec4 outputColor;

float distanceAttenuation(float distanceToLight, float range) {
  if (range <= 0.0) {
    return 1.0;
  }
  float factor = clamp(1.0 - distanceToLight / range, 0.0, 1.0);
  return factor * factor;
}

vec3 shadeLight(
  int index,
  vec3 normal,
  vec3 viewDir,
  float materialDiffuse,
  float materialSpecular,
  float shininess
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

  float diff = max(dot(normal, lightDir), 0.0);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), shininess);
  return lightColor * attenuation *
    (materialDiffuse * diff + materialSpecular * spec);
}

void main() {
  vec3 normal = normalize(v_Normal);
  vec3 viewDir = normalize(-v_FragPos);
  vec3 lighting = u_AmbientLight.rgb * u_LightParams.x;

  for (int i = 0; i < MAX_3D_LIGHTS; i++) {
    if (i >= int(u_LightCount.x)) {
      break;
    }
    lighting += shadeLight(
      i,
      normal,
      viewDir,
      u_LightParams.y,
      u_LightParams.z,
      u_LightParams.w
    );
  }

  vec4 baseColor = u_BaseColor;
  if (u_MaterialFlags.x > 0.5) {
    baseColor *= texture(SAMPLER_2D(u_Map), v_Uv);
  }

  vec3 result = lighting * baseColor.rgb;
  outputColor = vec4(result, baseColor.a);
}
`;
