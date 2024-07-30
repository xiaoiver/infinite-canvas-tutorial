export const vert = /* wgsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  float u_ZoomScale;
  float u_CheckboardStyle;
};

layout(location = 0) in vec2 a_Position;

out vec2 v_Position;

vec2 project_clipspace_to_world(vec2 p) {
  return (u_ViewProjectionInvMatrix * vec3(p, 1)).xy;
}

void main() {
  v_Position = project_clipspace_to_world(a_Position);
  gl_Position = vec4(a_Position, 0, 1);
}
`;

export const frag = /* wgsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  float u_ZoomScale;
  float u_CheckboardStyle;
};

out vec4 outputColor;

in vec2 v_Position;

const vec4 GRID_COLOR = vec4(0.87, 0.87, 0.87, 1.0);
const vec4 PAGE_COLOR = vec4(0.986, 0.986, 0.986, 1.0);
const int CHECKERBOARD_STYLE_NONE = 0;
const int CHECKERBOARD_STYLE_GRID = 1;
const int CHECKERBOARD_STYLE_DOTS = 2;
const float BASE_GRID_PIXEL_SIZE = 100.0;
const float BASE_DOT_SIZE = 8.0;

vec2 scale_grid_size(float zoom) {
  if (zoom < 0.125) return vec2(BASE_GRID_PIXEL_SIZE * 125.0, 0.125);
  else if (zoom < 0.25) return vec2(BASE_GRID_PIXEL_SIZE * 25.0, 0.25);
  else if (zoom < 0.5) return vec2(BASE_GRID_PIXEL_SIZE * 5.0, 0.5);
  return vec2(BASE_GRID_PIXEL_SIZE, 4.0);
}

vec4 render_grid_checkerboard(vec2 coord) {
  float alpha = 0.0;

  vec2 size = scale_grid_size(u_ZoomScale);
  float gridSize1 = size.x;
  float gridSize2 = gridSize1 / 10.0;
  float zoomStep = size.y;
  int checkboardStyle = int(floor(u_CheckboardStyle + 0.5));

  if (checkboardStyle == CHECKERBOARD_STYLE_GRID) {
    vec2 grid1 = abs(fract(coord / gridSize1 - 0.5) - 0.5) / fwidth(coord) * gridSize1 / 2.0;
    vec2 grid2 = abs(fract(coord / gridSize2 - 0.5) - 0.5) / fwidth(coord) * gridSize2;
    float v1 = 1.0 - min(min(grid1.x, grid1.y), 1.0);
    float v2 = 1.0 - min(min(grid2.x, grid2.y), 1.0);

    if (v1 > 0.0) {
      alpha = v1;
    } else {
      alpha = v2 * clamp(u_ZoomScale / zoomStep, 0.0, 1.0);
    }
  } else if (checkboardStyle == CHECKERBOARD_STYLE_DOTS) {
    vec2 grid2 = abs(fract(coord / gridSize2 - 0.5) - 0.5) / fwidth(coord) * gridSize2;
    alpha = smoothstep(1.0, 0.0, length(grid2) - BASE_DOT_SIZE * u_ZoomScale / zoomStep);
  }

  return mix(PAGE_COLOR, GRID_COLOR, alpha);
}

void main() {
  outputColor = render_grid_checkerboard(v_Position);
}
`;
