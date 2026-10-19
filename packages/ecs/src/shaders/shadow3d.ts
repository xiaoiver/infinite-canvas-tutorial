/** Packed depth color pass for directional 3D shadows. */
export const vert = /* glsl */ `
layout(std140) uniform ShadowScene3D {
  mat4 u_ShadowLightViewProjection;
};

layout(std140) uniform ShadowModel3D {
  mat4 u_ShadowModelMatrix;
};

layout(location = 0) in vec3 a_Position3D;
out float v_ShadowDepth;

void main() {
  vec4 clip = u_ShadowLightViewProjection * u_ShadowModelMatrix *
    vec4(a_Position3D, 1.0);
  gl_Position = clip;
  v_ShadowDepth = clip.z / clip.w * 0.5 + 0.5;
}
`;

export const frag = /* glsl */ `
layout(std140) uniform ShadowScene3D {
  mat4 u_ShadowLightViewProjection;
};

layout(std140) uniform ShadowModel3D {
  mat4 u_ShadowModelMatrix;
};

in float v_ShadowDepth;
out vec4 outputColor;

vec4 packDepth(float depth) {
  float d = clamp(depth, 0.0, 0.9999999);
  vec4 packed = fract(d * vec4(16777216.0, 65536.0, 256.0, 1.0));
  packed -= packed.xxyz * vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
  return packed;
}

void main() {
  outputColor = packDepth(v_ShadowDepth);
}
`;
