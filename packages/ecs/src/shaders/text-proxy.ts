export enum TextProxyLocation {
  POSITION = 0,
  RECT = 1,
  TRANSFORM = 2,
  STATE = 3,
  COLOR = 4,
}

/** A line is an instance; camera changes only update the shared scene buffer. */
export const textProxyVert = /* glsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  vec4 u_BackgroundColor;
  vec4 u_GridColor;
  float u_ZoomScale;
  float u_CheckboardStyle;
};
layout(location = ${TextProxyLocation.POSITION}) in vec2 a_Position;
layout(location = ${TextProxyLocation.RECT}) in vec4 a_Rect;
layout(location = ${TextProxyLocation.TRANSFORM}) in vec4 a_Transform;
layout(location = ${TextProxyLocation.STATE}) in vec4 a_State;
layout(location = ${TextProxyLocation.COLOR}) in vec4 a_Color;
out vec4 v_Color;
void main() {
  vec2 local = a_Rect.xy + a_Position * a_Rect.zw;
  vec2 world = vec2(dot(a_Transform.xz, local), dot(a_Transform.yw, local)) + a_State.xy;
  gl_Position = vec4((u_ProjectionMatrix * u_ViewMatrix * vec3(world, 1.0)).xy, a_State.z, 1.0);
  v_Color = vec4(a_Color.rgb, a_Color.a * a_State.w);
}
`;

export const textProxyFrag = /* glsl */ `
in vec4 v_Color;
out vec4 outputColor;
void main() {
  if (v_Color.a < 0.000001) discard;
  outputColor = v_Color;
}
`;
