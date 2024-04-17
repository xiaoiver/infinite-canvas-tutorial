export const vert = /* wgsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
};

layout(location = 0) in vec4 a_Position;
layout(location = 1) in vec4 a_Color;

out vec2 v_Uv;
out vec4 v_Color;

void main() {
  v_Uv = a_Position.zw;
  v_Color = a_Color;
  vec2 position = (u_ProjectionMatrix * vec3(a_Position.xy, 1)).xy;
  gl_Position = vec4(position, 0, 1);
}
`;

export const frag = /* wgsl */ `
out vec4 outputColor;

in vec2 v_Uv;
in vec4 v_Color;

void main() {
  outputColor = v_Color * min(1.0, min(v_Uv.x, v_Uv.y));
}
`;
