export const vert = /* wgsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
};

layout(std140) uniform ShapeUniforms {
  mat3 u_ModelMatrix;
};

layout(location = 0) in vec2 a_FragCoord;
layout(location = 1) in vec2 a_Position;
layout(location = 2) in vec2 a_Size;
layout(location = 3) in vec4 a_FillColor;

out vec2 v_FragCoord;
out vec4 v_FillColor;

void main() {
  v_FragCoord = a_FragCoord;
  v_FillColor = a_FillColor;

  gl_Position = vec4((u_ProjectionMatrix 
    * u_ViewMatrix
    * u_ModelMatrix 
    * vec3(a_Position + a_Size * a_FragCoord, 1)).xy, 0, 1);
}
`;

export const frag = /* wgsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
};

layout(std140) uniform ShapeUniforms {
  mat3 u_ModelMatrix;
};

out vec4 outputColor;

in vec2 v_FragCoord;
in vec4 v_FillColor;

float sdf_circle(vec2 p, float r) {
  return length(p) - r;
}

void main() {
  float distance = sdf_circle(v_FragCoord, 1.0);

  if (distance > 0.0) {
    discard;
  }
  
  float alpha = clamp(-distance / fwidth(-distance), 0.0, 1.0);

  outputColor = v_FillColor;
  outputColor.a *= alpha;
}
`;
