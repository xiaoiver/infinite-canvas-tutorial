import { createSdfFragment } from './sdf';
export const imageBatchVert = `precision highp float;
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  vec4 u_BackgroundColor;
  vec4 u_GridColor;
  float u_ZoomScale;
  float u_CheckboardStyle;
};
layout(location = 1) in vec2 a_FragCoord;
layout(location = 2) in vec4 a_Matrix;
layout(location = 3) in vec4 a_Placement;
layout(location = 4) in vec4 a_Bounds;
layout(location = 5) in vec4 a_Policy;
layout(location = 6) in vec4 a_Stroke;
out vec2 v_FragCoord;
out vec2 v_Radius;
out vec2 v_Uv;
out vec4 v_FillColor;
out vec4 v_StrokeColor;
out float v_StrokeWidth;
out vec4 v_Opacity;
out float v_CornerRadius;
out float v_StrokeAlignment;
out vec4 v_InnerShadowColor;
out vec4 v_InnerShadow;
void main() {
  mat3 model = mat3(a_Matrix.x, a_Matrix.y, 0.0,
    a_Matrix.z, a_Matrix.w, 0.0, a_Placement.x, a_Placement.y, 1.0);
  float offset = a_Policy.w < 0.5 ? a_Policy.y / 2.0 :
    (a_Policy.w < 1.5 ? 0.0 : a_Policy.y);
  vec2 radius = a_Bounds.zw + vec2(offset);
  v_FragCoord = a_FragCoord * radius;
  v_Radius = abs(radius);
  v_Uv = (a_FragCoord * radius / a_Bounds.zw + 1.0) / 2.0;
  v_FillColor = vec4(a_Placement.w, 0.0, 0.0, 1.0);
  v_StrokeColor = a_Stroke;
  v_StrokeWidth = a_Policy.y;
  v_Opacity = vec4(a_Placement.z, a_Policy.z, 1.0, 2.0);
  v_CornerRadius = 0.0;
  v_StrokeAlignment = a_Policy.w;
  v_InnerShadowColor = vec4(0.0);
  v_InnerShadow = vec4(0.0);
  gl_Position = vec4((u_ProjectionMatrix * u_ViewMatrix * model *
    vec3(a_Bounds.xy + v_FragCoord, 1.0)).xy, a_Policy.x, 1.0);
}
`;

export const imageBatchFrag = createSdfFragment(
  Array.from(
    { length: 8 },
    (_, i) => '  uniform sampler2D u_Image' + i + ';',
  ).join('\n'),
  Array.from(
    { length: 8 },
    (_, i) =>
      (i === 0 ? '    if' : i === 7 ? '    else' : '    else if') +
      (i === 7 ? '' : ' (v_FillColor.r < ' + i + '.5)') +
      ' fillColor = texture(SAMPLER_2D(u_Image' +
      i +
      '), v_Uv);',
  ).join('\n'),
);
