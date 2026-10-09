/**
 * EWA (Elliptical Weighted Average) splatting shaders for 3D Gaussian Splatting.
 *
 * Each gaussian is drawn as a screen-aligned quad (4 vertices, instanced). The
 * vertex shader projects the gaussian's 3D covariance `Σ` into a 2D screen-space
 * covariance using the perspective Jacobian, then expands the quad along the
 * resulting ellipse's major/minor axes. The fragment shader evaluates the 2D
 * gaussian and outputs a premultiplied-alpha color for back-to-front "over"
 * compositing.
 *
 * Written in GLSL 3.00 ES so `@infinite-canvas-tutorial/device-api` can transpile
 * it to both WebGL2 and WebGPU. Adapted from the well-known antimatter15/splat
 * reference WebGL implementation.
 *
 * Per-instance attributes carry the gaussian's center, color (RGB DC + opacity),
 * and the 6 unique entries of the symmetric 3D covariance, split as
 * `covA = (σxx, σxy, σxz)` and `covB = (σyy, σyz, σzz)`.
 *
 * @see https://github.com/antimatter15/splat
 */

export const vert = /* glsl */ `
layout(std140) uniform GsplatUniforms {
  mat4 u_Projection;
  mat4 u_View;
  // xy: viewport size in pixels; zw: reserved.
  vec4 u_Viewport;
};

layout(location = 0) in vec2 a_QuadCorner;
layout(location = 1) in vec3 a_Center;
layout(location = 2) in vec4 a_Color;
layout(location = 3) in vec3 a_CovA;
layout(location = 4) in vec3 a_CovB;

out vec4 v_Color;
out vec2 v_Position;

void main() {
  vec4 cam = u_View * vec4(a_Center, 1.0);
  vec4 pos2d = u_Projection * cam;

  // Frustum cull with a small margin; emit an off-screen vertex on reject.
  float clip = 1.2 * pos2d.w;
  if (pos2d.z < -clip ||
      pos2d.x < -clip || pos2d.x > clip ||
      pos2d.y < -clip || pos2d.y > clip) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  // Focal length in pixels, derived from the projection matrix and viewport.
  vec2 focal = vec2(
    u_Projection[0][0] * 0.5 * u_Viewport.x,
    u_Projection[1][1] * 0.5 * u_Viewport.y
  );

  // Symmetric 3D covariance Σ.
  mat3 Vrk = mat3(
    a_CovA.x, a_CovA.y, a_CovA.z,
    a_CovA.y, a_CovB.x, a_CovB.y,
    a_CovA.z, a_CovB.y, a_CovB.z
  );

  // Perspective Jacobian of the projection at the gaussian center.
  mat3 J = mat3(
    focal.x / cam.z, 0.0, -(focal.x * cam.x) / (cam.z * cam.z),
    0.0, focal.y / cam.z, -(focal.y * cam.y) / (cam.z * cam.z),
    0.0, 0.0, 0.0
  );

  mat3 W = transpose(mat3(u_View));
  mat3 T = W * J;
  mat3 cov = transpose(T) * Vrk * T;

  // 2D covariance with a low-pass (dilation) filter to keep tiny splats visible.
  float diagonal1 = cov[0][0] + 0.3;
  float offDiagonal = cov[0][1];
  float diagonal2 = cov[1][1] + 0.3;

  float mid = 0.5 * (diagonal1 + diagonal2);
  float radius = length(vec2((diagonal1 - diagonal2) * 0.5, offDiagonal));
  float lambda1 = mid + radius;
  float lambda2 = mid - radius;
  if (lambda2 < 0.0) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
  vec2 majorAxis = min(sqrt(2.0 * lambda1), 1024.0) * diagonalVector;
  vec2 minorAxis = min(sqrt(2.0 * lambda2), 1024.0) * vec2(diagonalVector.y, -diagonalVector.x);

  v_Color = a_Color;
  v_Position = a_QuadCorner;

  vec2 vCenter = pos2d.xy / pos2d.w;
  gl_Position = vec4(
    vCenter
      + a_QuadCorner.x * majorAxis / u_Viewport.xy
      + a_QuadCorner.y * minorAxis / u_Viewport.xy,
    0.0,
    1.0
  );
}
`;

export const frag = /* glsl */ `
in vec4 v_Color;
in vec2 v_Position;

out vec4 outputColor;

void main() {
  // 2D gaussian weight; a_QuadCorner spans [-2, 2] so the corners fall off fast.
  float A = -dot(v_Position, v_Position);
  if (A < -4.0) {
    discard;
  }
  float B = exp(A) * v_Color.a;
  // Premultiplied alpha for back-to-front "over" compositing.
  outputColor = vec4(B * v_Color.rgb, B);
}
`;
