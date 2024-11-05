export enum Location {
  POSITION,
  ABCD,
  TXTY,
  FILL_COLOR,
  STROKE_COLOR,
  ZINDEX_STROKE_WIDTH,
  OPACITY,
}

export const vert = /* wgsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  vec4 u_BackgroundColor;
  vec4 u_GridColor;
  float u_ZoomScale;
  float u_CheckboardStyle;
};

layout(location = ${Location.POSITION}) in vec2 a_Position;
#ifdef USE_INSTANCES
  layout(location = ${Location.ABCD}) in vec4 a_Abcd;
  layout(location = ${Location.TXTY}) in vec2 a_Txty;
  layout(location = ${Location.FILL_COLOR}) in vec4 a_FillColor;
  layout(location = ${Location.STROKE_COLOR}) in vec4 a_StrokeColor;
  layout(location = ${Location.ZINDEX_STROKE_WIDTH}) in vec4 a_ZIndexStrokeWidth;
  layout(location = ${Location.OPACITY}) in vec4 a_Opacity;
#else
  layout(std140) uniform ShapeUniforms {
    mat3 u_ModelMatrix;
    vec4 u_FillColor;
    vec4 u_StrokeColor;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_Opacity;
  };
#endif

#ifdef USE_INSTANCES
  out vec4 v_FillColor;
  out vec4 v_StrokeColor;
  out float v_StrokeWidth;
  out vec4 v_Opacity;
  out float v_CornerRadius;
  out float v_StrokeAlignment;
#else
#endif

void main() {
  mat3 model;
  vec4 fillColor;
  vec4 strokeColor;
  float zIndex;
  float strokeWidth;
  float strokeAlignment;

  #ifdef USE_INSTANCES
    model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
    fillColor = a_FillColor;
    strokeColor = a_StrokeColor;
    zIndex = a_ZIndexStrokeWidth.x;
    strokeWidth = a_ZIndexStrokeWidth.y;
    strokeAlignment = a_ZIndexStrokeWidth.w;

    v_FillColor = fillColor;
    v_StrokeColor = strokeColor;
    v_StrokeWidth = strokeWidth;
    v_Opacity = a_Opacity;
    v_CornerRadius = a_ZIndexStrokeWidth.z;
    v_StrokeAlignment = a_ZIndexStrokeWidth.w;
  #else
    model = u_ModelMatrix;
    fillColor = u_FillColor;
    strokeColor = u_StrokeColor;
    zIndex = u_ZIndexStrokeWidth.x;
    strokeWidth = u_ZIndexStrokeWidth.y;
    strokeAlignment = u_ZIndexStrokeWidth.w;
  #endif

  gl_Position = vec4((u_ProjectionMatrix 
    * u_ViewMatrix
    * model 
    * vec3(a_Position, 1)).xy, zIndex, 1);
}
`;

export const frag = /* wgsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  vec4 u_BackgroundColor;
  vec4 u_GridColor;
  float u_ZoomScale;
  float u_CheckboardStyle;
};

#ifdef USE_INSTANCES
#else
  layout(std140) uniform ShapeUniforms {
    mat3 u_ModelMatrix;
    vec4 u_FillColor;
    vec4 u_StrokeColor;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_Opacity;
  };
#endif

out vec4 outputColor;

#ifdef USE_INSTANCES
  in vec4 v_FillColor;
  in vec4 v_StrokeColor;
  in float v_StrokeWidth;
  in vec4 v_Opacity;
  in float v_CornerRadius;
  in float v_StrokeAlignment;
#else
#endif

float epsilon = 0.000001;

void main() {
  float strokeWidth;
  vec4 fillColor;
  vec4 strokeColor;
  float opacity;
  float fillOpacity;
  float strokeOpacity;
  float cornerRadius;
  float strokeAlignment;
  
  #ifdef USE_INSTANCES
    fillColor = v_FillColor;
    strokeColor = v_StrokeColor;
    strokeWidth = v_StrokeWidth;
    opacity = v_Opacity.x;
    fillOpacity = v_Opacity.y;
    strokeOpacity = v_Opacity.z;
    cornerRadius = v_CornerRadius;
    strokeAlignment = v_StrokeAlignment;
  #else
    fillColor = u_FillColor;
    strokeColor = u_StrokeColor;
    strokeWidth = u_ZIndexStrokeWidth.y;
    opacity = u_Opacity.x;
    fillOpacity = u_Opacity.y;
    strokeOpacity = u_Opacity.z;
    cornerRadius = u_ZIndexStrokeWidth.z;
    strokeAlignment = u_ZIndexStrokeWidth.w;
  #endif

  // based on the target alpha compositing mode.
  fillColor.a *= fillOpacity;
  strokeColor.a *= strokeOpacity;
  
  outputColor = fillColor;
  outputColor.a *= opacity;

  if (outputColor.a < epsilon)
    discard;
}
`;
