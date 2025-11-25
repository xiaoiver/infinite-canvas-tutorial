export enum Location {
  POSITION = 0,
  UV = 1,
}

export const vert = /* wgsl */ `
layout(location = ${Location.POSITION}) in vec2 a_Position;
layout(location = ${Location.UV}) in vec2 a_Uv;

out vec2 v_Uv;

void main() {
  v_Uv = a_Uv;
  gl_Position = vec4(a_Position, 0.0, 1.0);
}
`;
