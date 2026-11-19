export enum PathInstanceLocation {
  POSITION = 0,
  TRANSFORM = 1,
  STATE = 2,
  COLOR = 3,
}

/** One retained fill mesh, with affine placement and paint per instance. */
export const pathInstanceVert = /* glsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  vec4 u_BackgroundColor;
  vec4 u_GridColor;
  float u_ZoomScale;
  float u_CheckboardStyle;
};
layout(location = ${PathInstanceLocation.POSITION}) in vec2 a_Position;
layout(location = ${PathInstanceLocation.TRANSFORM}) in vec4 a_Transform;
layout(location = ${PathInstanceLocation.STATE}) in vec4 a_State;
layout(location = ${PathInstanceLocation.COLOR}) in vec4 a_Color;
out vec4 v_Color;
void main() {
  mat3 model = mat3(a_Transform.x, a_Transform.y, 0.0,
                    a_Transform.z, a_Transform.w, 0.0,
                    a_State.x, a_State.y, 1.0);
  gl_Position = vec4((u_ProjectionMatrix * u_ViewMatrix * model * vec3(a_Position, 1.0)).xy, a_State.z, 1.0);
  v_Color = vec4(a_Color.rgb, a_Color.a * a_State.w);
}
`;

export const pathInstanceFrag = /* glsl */ `
in vec4 v_Color;
out vec4 outputColor;
void main() {
  if (v_Color.a < 0.000001) discard;
  outputColor = v_Color;
}
`;
