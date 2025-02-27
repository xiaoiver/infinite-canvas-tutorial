export const vert = /* wgsl */ `
layout(std140) uniform Uniforms {
  float u_Time;
};

layout(location = 0) in vec2 a_Position;

out vec2 v_TexCoord;

void main() {
  v_TexCoord = 0.5 * (a_Position + 1.0);
  gl_Position = vec4(a_Position, 0.0, 1.0);

  #ifdef VIEWPORT_ORIGIN_TL
    v_TexCoord.y = 1.0 - v_TexCoord.y;
  #endif
}
`;

export const frag = /* wgsl */ `
layout(std140) uniform Uniforms {
  float u_Time;
};

in vec2 v_TexCoord;

out vec4 outputColor;

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

vec2 random2( vec2 p ) {
  return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}

void main() {
  vec2 st = v_TexCoord;

  vec3 color = vec3(.0);

  // Scale
  st *= 3.;

  // Tile the space
  vec2 i_st = floor(st);
  vec2 f_st = fract(st);

  float m_dist = 1.;  // minimun distance

  for (int y= -1; y <= 1; y++) {
      for (int x= -1; x <= 1; x++) {
          // Neighbor place in the grid
          vec2 neighbor = vec2(float(x),float(y));

          // Random position from current + neighbor place in the grid
          vec2 point = random2(i_st + neighbor);

    // Animate the point
          point = 0.5 + 0.5*sin(u_Time + 6.2831*point);

    // Vector between the pixel and the point
          vec2 diff = neighbor + point - f_st;

          // Distance to the point
          float dist = length(diff);

          // Keep the closer distance
          m_dist = min(m_dist, dist);
      }
  }

  // Draw the min distance (distance field)
  color += m_dist;

  // Draw cell center
  color += 1.-step(.02, m_dist);

  // Draw grid
  color.r += step(.98, f_st.x) + step(.98, f_st.y);

  // Show isolines
  // color -= step(.7,abs(sin(27.0*m_dist)))*.5;

  outputColor = vec4(color, 1.0);
}
`;
