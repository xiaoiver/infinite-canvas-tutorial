export enum Location {
  BARYCENTRIC = 0,
}

export const vert = /* wgsl */ `
#ifdef USE_WIREFRAME
  v_Barycentric = a_Barycentric;
#endif
`;

export const vert_declaration = /* wgsl */ `
#ifdef USE_WIREFRAME
  layout(location = ${Location.BARYCENTRIC}) in vec3 a_Barycentric;
  out vec3 v_Barycentric;
#endif
`;

export const frag = /* wgsl */ `
#ifdef USE_WIREFRAME
  vec3 u_WireframeLineColor = vec3(0.0, 0.0, 0.0);

  outputColor.xyz = mix(outputColor.xyz, u_WireframeLineColor, (1.0 - edgeFactor()));
  if (any(lessThan(v_Barycentric, vec3(0.01)))) {
    outputColor.a = 0.95;
  }
#endif
`;

export const frag_declaration = /* wgsl */ `
#ifdef USE_WIREFRAME
  in vec3 v_Barycentric;

  float edgeFactor() {
    float u_WireframeLineWidth = 1.0;
    vec3 d = fwidth(v_Barycentric);
    vec3 a3 = smoothstep(vec3(0.0), d * u_WireframeLineWidth, v_Barycentric);
    return min(min(a3.x, a3.y), a3.z);
  }
#endif
`;
