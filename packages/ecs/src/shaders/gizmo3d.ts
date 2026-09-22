/**
 * Gizmo 3D shader – unlit, always-on-top (depth test disabled).
 * Renders with a flat color per-part, no lighting calculation.
 */

export const gizmoVert = /* glsl */ `
layout(std140) uniform GizmoSceneUniforms {
  mat4 u_GizmoViewProjection;
};

layout(std140) uniform GizmoModelUniforms {
  mat4 u_GizmoModel;
  vec4 u_GizmoColor;
};

layout(location = 0) in vec3 a_Position3D;
layout(location = 1) in vec3 a_Normal3D;

out vec3 v_GizmoNormal;

void main() {
  gl_Position = u_GizmoViewProjection * u_GizmoModel * vec4(a_Position3D, 1.0);
  v_GizmoNormal = a_Normal3D;
}
`;

export const gizmoFrag = /* glsl */ `
layout(std140) uniform GizmoModelUniforms {
  mat4 u_GizmoModel;
  vec4 u_GizmoColor;
};

in vec3 v_GizmoNormal;
out vec4 outputColor;

void main() {
  // Simple pseudo-lighting for depth cue (not physically based)
  vec3 n = normalize(v_GizmoNormal);
  float shade = 0.6 + 0.4 * max(dot(n, normalize(vec3(0.5, 0.7, 0.5))), 0.0);
  outputColor = vec4(u_GizmoColor.rgb * shade, u_GizmoColor.a);
}
`;
