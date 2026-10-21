/** Packed depth color pass for directional and spot 3D shadows. */
export const vert = /* glsl */ `
layout(std140) uniform ShadowScene3D {
  mat4 u_ShadowLightViewProjection;
};

layout(std140) uniform ShadowModel3D {
  mat4 u_ShadowModelMatrix;
  mat4 u_UnusedNormalMatrix;
  vec4 u_BaseColor;
  vec4 u_UnusedLightParams[3];
  vec4 u_MaterialFlags;
  vec4 u_PbrParams;
  vec4 u_SideColor;
  vec4 u_UnusedIrradiance[9];
  vec4 u_ShadowReceive;
  vec4 u_TextureCoords;
  vec4 u_MapUvTransform;
  vec4 u_PbrUvTransform;
  vec4 u_UvRotations;
};

layout(location = 0) in vec3 a_Position3D;
layout(location = 1) in vec2 a_Uv3D;
layout(location = 2) in vec3 a_Normal3D;
layout(location = 3) in vec2 a_Uv1_3D;
layout(location = 4) in vec4 a_Color3D;
out vec4 v_ShadowClip;
out vec2 v_Uv;
out vec2 v_Uv1;
out float v_LocalNormalZ;
out float v_ColorAlpha;

void main() {
  vec4 clip = u_ShadowLightViewProjection * u_ShadowModelMatrix *
    vec4(a_Position3D, 1.0);
  gl_Position = clip;
  v_ShadowClip = clip;
  v_Uv = a_Uv3D;
  v_Uv1 = a_Uv1_3D;
  v_LocalNormalZ = a_Normal3D.z;
  v_ColorAlpha = a_Color3D.a;
}
`;

export const frag = /* glsl */ `
layout(std140) uniform ShadowScene3D {
  mat4 u_ShadowLightViewProjection;
};

layout(std140) uniform ShadowModel3D {
  mat4 u_ShadowModelMatrix;
  mat4 u_UnusedNormalMatrix;
  vec4 u_BaseColor;
  vec4 u_UnusedLightParams[3];
  vec4 u_MaterialFlags;
  vec4 u_PbrParams;
  vec4 u_SideColor;
  vec4 u_UnusedIrradiance[9];
  vec4 u_ShadowReceive;
  vec4 u_TextureCoords;
  vec4 u_MapUvTransform;
  vec4 u_PbrUvTransform;
  vec4 u_UvRotations;
};

uniform sampler2D u_Map;
in vec4 v_ShadowClip;
in vec2 v_Uv;
in vec2 v_Uv1;
in float v_LocalNormalZ;
in float v_ColorAlpha;
out vec4 outputColor;

vec4 packDepth(float depth) {
  float d = clamp(depth, 0.0, 0.9999999);
  vec4 depthColor = fract(d * vec4(16777216.0, 65536.0, 256.0, 1.0));
  depthColor -= depthColor.xxyz * vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
  return depthColor;
}

vec2 transformUv(vec2 uv, vec4 transform, float rotation) {
  vec2 scaled = uv * transform.zw;
  float c = cos(rotation);
  float s = sin(rotation);
  return transform.xy + vec2(c * scaled.x - s * scaled.y,
                             s * scaled.x + c * scaled.y);
}

void main() {
  if (u_ShadowReceive.y > 0.5) {
    float alpha = u_PbrParams.z > 0.5 && abs(v_LocalNormalZ) < 1.0
      ? u_SideColor.a : u_BaseColor.a;
    alpha *= v_ColorAlpha;
    if (u_MaterialFlags.x > 0.5)
      alpha *= texture(SAMPLER_2D(u_Map),
        transformUv(u_TextureCoords.x > 0.5 ? v_Uv1 : v_Uv,
                    u_MapUvTransform, u_UvRotations.x)).a;
    if (u_ShadowReceive.y < 1.5) {
      if (alpha < u_ShadowReceive.z) discard;
    } else {
      // Stable screen-door coverage approximates fractional shadow opacity
      // with the existing packed-depth map and its PCF filter.
      float threshold = fract(sin(dot(floor(gl_FragCoord.xy),
        vec2(12.9898, 78.233))) * 43758.5453);
      if (alpha <= threshold) discard;
    }
  }
  outputColor = packDepth(v_ShadowClip.z / v_ShadowClip.w * 0.5 + 0.5);
}
`;
