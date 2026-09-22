/** Instanced raindrop pass (raindrop-fx raindrop-vert / raindrop-frag). */
export enum RainFxRaindropLocation {
  POS = 0,
  UV = 1,
  INST = 2,
  SIZE_NORM = 3,
}

export const vert = /* glsl */ `
layout(location = ${RainFxRaindropLocation.POS}) in vec3 a_Pos;
layout(location = ${RainFxRaindropLocation.UV}) in vec2 a_UV;
layout(location = ${RainFxRaindropLocation.INST}) in vec4 a_Inst;
layout(location = ${RainFxRaindropLocation.SIZE_NORM}) in float a_SizeNorm;

layout(std140) uniform RainFxRaindropUniforms {
  mat4 u_VP;
};

out vec2 v_UV;
out float v_Size;

void main() {
  mat4 model = mat4(
    a_Inst.z, 0.0, 0.0, 0.0,
    0.0, a_Inst.w, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    a_Inst.x, a_Inst.y, 0.0, 1.0
  );
  gl_Position = u_VP * model * vec4(a_Pos, 1.0);
  v_UV = a_UV;
  v_Size = a_SizeNorm;
}
`;

export const frag = /* glsl */ `
uniform sampler2D u_Texture;
in vec2 v_UV;
in float v_Size;
out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_UV).rgba;
  outputColor = vec4(color.rg * color.a, v_Size * color.a, color.a);
}
`;
