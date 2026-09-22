/**
 * Gizmo display shader – unlit, same projection as mesh3d (including linked perspective).
 * sceneParams.xy: Z-axis screen bias (linked perspective, translate blue arrow only).
 * u_LightParams.y: 1 = apply Z bias; 0 = mesh3d-style linked projection (rotate rings, etc.).
 * u_SceneParams.w: 1 = active handle highlight (yellow), WebGPU-safe via scene UBO.
 */

export const gizmoDisplayVert = /* glsl */ `
layout(std140) uniform SceneUniforms3D {
  mat4 u_ProjectionMatrix3D;
  mat4 u_ViewMatrix3D;
  mat4 u_CanvasViewProjection3D;
  // xy: Z-axis screen bias (linked perspective), z: linked flag
  vec4 u_SceneParams;
};

layout(std140) uniform ModelUniforms3D {
  mat4 u_ModelMatrix3D;
  mat4 u_NormalMatrix3D;
  vec4 u_BaseColor;
  vec4 u_LightParams;
  vec4 u_LightDirection;
  vec4 u_CanvasAnchor;
};

layout(location = 0) in vec3 a_Position3D;
layout(location = 1) in vec3 a_Normal3D;
layout(location = 2) in vec4 a_GizmoColor;

out vec4 v_GizmoColor;

void main() {
  v_GizmoColor = a_GizmoColor;
  if (u_SceneParams.w > 0.5) {
    v_GizmoColor = vec4(1.0, 1.0, 0.0, a_GizmoColor.a);
  }
  vec4 worldPos = u_ModelMatrix3D * vec4(a_Position3D, 1.0);

  if (u_SceneParams.z > 0.5) {
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
    float scale = pw / clipPwRef;
    gl_Position.xy = anchor2d.xy + (clip2d.xy - anchor2d.xy) * scale;
    if (u_LightParams.y > 0.5) {
      float zDelta = worldPos.z - u_CanvasAnchor.z;
      gl_Position.xy += u_SceneParams.xy * zDelta * clip2d.w;
    }
    gl_Position.z = clipP.z * clip2d.w / pw;
    gl_Position.w = clip2d.w;
  } else {
    gl_Position = u_ProjectionMatrix3D * u_ViewMatrix3D * worldPos;
  }
}
`;

export const gizmoDisplayFrag = /* glsl */ `
in vec4 v_GizmoColor;

out vec4 outputColor;

void main() {
  outputColor = v_GizmoColor;
}
`;
