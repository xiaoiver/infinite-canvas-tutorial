export enum Location {
  POSITION = 0,
}

export const vert = /* wgsl */ `
layout(location = ${Location.POSITION}) in vec2 a_Position;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_InputSize;
  vec4 u_OutputFrame;
  vec4 u_OutputTexture;
};

out vec2 v_Uv;

void main() {
  v_Uv = a_Position * (u_OutputFrame.zw / u_InputSize.xy) + u_OutputFrame.xy / u_InputSize.xy;
  
  gl_Position = vec4((a_Position * 2.0 - 1.0) * u_OutputTexture.xy / u_OutputFrame.zw * u_OutputTexture.z, 0.0, 1.0);

  // #ifdef VIEWPORT_ORIGIN_TL
  //   v_Uv.y = 1.0 - v_Uv.y;
  // #endif
  v_Uv.y = 1.0 - v_Uv.y;
}
`;
