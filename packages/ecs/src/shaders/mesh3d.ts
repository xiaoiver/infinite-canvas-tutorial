/**
 * Basic 3D mesh shader with Blinn-Phong lighting.
 * Uses a single directional light and per-vertex normals.
 */

export const vert = /* glsl */ `
layout(std140) uniform SceneUniforms3D {
  mat4 u_ProjectionMatrix3D;
  mat4 u_ViewMatrix3D;
  mat4 u_CanvasViewProjection3D;
  // z=1: linked perspective (2D VP + depth scale from anchor)
  vec4 u_SceneParams;
};

layout(std140) uniform ModelUniforms3D {
  mat4 u_ModelMatrix3D;
  mat4 u_NormalMatrix3D;
  vec4 u_BaseColor;
  vec4 u_LightParams; // x: ambient, y: diffuse, z: specular, w: shininess
  vec4 u_LightDirection; // xyz: direction (normalized), w: unused
  // xy: Transform3D.translation (perspective anchor on canvas)
  vec4 u_CanvasAnchor;
};

layout(location = 0) in vec3 a_Position3D;
layout(location = 1) in vec3 a_Normal3D;

out vec3 v_Normal;
out vec3 v_FragPos;

void main() {
  vec4 worldPos = u_ModelMatrix3D * vec4(a_Position3D, 1.0);
  v_FragPos = worldPos.xyz;
  v_Normal = (u_NormalMatrix3D * vec4(a_Normal3D, 0.0)).xyz;

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
layout(std140) uniform ModelUniforms3D {
  mat4 u_ModelMatrix3D;
  mat4 u_NormalMatrix3D;
  vec4 u_BaseColor;
  vec4 u_LightParams; // x: ambient, y: diffuse, z: specular, w: shininess
  vec4 u_LightDirection; // xyz: direction (normalized), w: unused
  // xy: Transform3D.translation (perspective anchor on canvas)
  vec4 u_CanvasAnchor;
};

layout(std140) uniform SceneUniforms3D {
  mat4 u_ProjectionMatrix3D;
  mat4 u_ViewMatrix3D;
  mat4 u_CanvasViewProjection3D;
  vec4 u_SceneParams;
};

in vec3 v_Normal;
in vec3 v_FragPos;

out vec4 outputColor;

void main() {
  vec3 normal = normalize(v_Normal);
  vec3 lightDir = normalize(-u_LightDirection.xyz);

  // Ambient
  float ambient = u_LightParams.x;

  // Diffuse
  float diff = max(dot(normal, lightDir), 0.0);
  float diffuse = u_LightParams.y * diff;

  // Specular (Blinn-Phong)
  vec3 viewDir = normalize(-v_FragPos);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), u_LightParams.w);
  float specular = u_LightParams.z * spec;

  vec3 result = (ambient + diffuse + specular) * u_BaseColor.rgb;
  outputColor = vec4(result, u_BaseColor.a);
}
`;
