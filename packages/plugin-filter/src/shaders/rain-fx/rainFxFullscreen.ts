/** Fullscreen triangle (covers NDC clip space). */
export const vert = /* glsl */ `
layout(location = 0) in vec2 a_Position;
out vec2 v_UV;

void main() {
  v_UV = a_Position * 0.5 + 0.5;
  gl_Position = vec4(a_Position, 0.0, 1.0);
}
`;
