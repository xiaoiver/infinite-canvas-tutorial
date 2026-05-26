export enum Location {
  POSITION = 0,
}

export const vert = /* wgsl */ `
layout(location = ${Location.POSITION}) in vec2 a_Position;

out vec2 v_Uv;

void main() {
  v_Uv = 0.5 * (a_Position + 1.0);
  gl_Position = vec4(a_Position, 0.0, 1.0);

  #ifdef VIEWPORT_ORIGIN_TL
    v_Uv.y = 1.0 - v_Uv.y;
  #endif
}
`;
