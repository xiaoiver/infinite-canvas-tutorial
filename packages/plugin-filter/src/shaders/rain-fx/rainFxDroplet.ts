/** Procedural tiny droplets (raindrop-fx droplet-vert / droplet). */
export enum RainFxDropletLocation {
  POS = 0,
  UV = 1,
}

export const vert = /* glsl */ `
layout(location = ${RainFxDropletLocation.POS}) in vec3 a_Pos;
layout(location = ${RainFxDropletLocation.UV}) in vec2 a_UV;

layout(std140) uniform RainFxDropletUniforms {
  mat4 u_VP;
  float u_Seed;
  vec4 u_SpawnRect;
  vec2 u_SizeRange;
};

out vec2 v_UV;

const float PHI = 1.61803398874989484820459;

float gold_noise(vec2 xy, float seed) {
  return fract(tan(distance(xy * PHI, xy) * seed) * xy.x);
}

void main() {
  int id = gl_InstanceID + 1;
  vec2 pos = u_SpawnRect.xy + u_SpawnRect.zw * vec2(
    gold_noise(vec2(1.0, float(id)), u_Seed + 1.0),
    gold_noise(vec2(float(id), 1.0), u_Seed + 2.0)
  );
  vec2 t = vec2(
    gold_noise(vec2(1.0, float(id)), u_Seed + 3.0),
    gold_noise(vec2(float(id), 1.0), u_Seed + 4.0)
  );
  float sz = mix(u_SizeRange.x, u_SizeRange.y, t.x);
  mat4 model = mat4(
    sz, 0.0, 0.0, 0.0,
    0.0, sz, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    pos.x, pos.y, 0.0, 1.0
  );
  gl_Position = u_VP * model * vec4(a_Pos, 1.0);
  v_UV = a_UV;
}
`;

export const frag = /* glsl */ `
uniform sampler2D u_Texture;
in vec2 v_UV;
out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_UV).rgba;
  color.rgb *= color.a;
  outputColor = vec4(color.rg, 0.0, color.a);
}
`;
