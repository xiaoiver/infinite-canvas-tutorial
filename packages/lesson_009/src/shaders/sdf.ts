export const vert = /* wgsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
};

layout(location = 0) in vec2 a_FragCoord;

#ifdef USE_INSTANCES
  layout(location = 14) in vec4 a_Abcd;
  layout(location = 15) in vec2 a_Txty;
  layout(location = 1) in vec4 a_PositionSize;
  layout(location = 2) in vec4 a_FillColor;
  layout(location = 3) in vec4 a_StrokeColor;
  layout(location = 4) in vec4 a_ZIndexStrokeWidth;
  layout(location = 5) in vec4 a_Opacity;
#else
  layout(std140) uniform ShapeUniforms {
    mat3 u_ModelMatrix;
    vec4 u_PositionSize;
    vec4 u_FillColor;
    vec4 u_StrokeColor;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_Opacity;
  };
#endif

out vec2 v_FragCoord;
#ifdef USE_INSTANCES
  out vec4 v_FillColor;
  out vec4 v_StrokeColor;
  out float v_StrokeWidth;
  out vec4 v_Opacity;
  out vec2 v_RxRy;
#else
#endif
out vec2 v_Radius;

void main() {
  mat3 model;
  vec2 position;
  vec2 size;
  vec4 fillColor;
  vec4 strokeColor;
  float zIndex;
  float strokeWidth;

  #ifdef USE_INSTANCES
    model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
    position = a_PositionSize.xy;
    size = a_PositionSize.zw;
    fillColor = a_FillColor;
    strokeColor = a_StrokeColor;
    zIndex = a_ZIndexStrokeWidth.x;
    strokeWidth = a_ZIndexStrokeWidth.y;

    v_FillColor = fillColor;
    v_StrokeColor = strokeColor;
    v_StrokeWidth = strokeWidth;
    v_Opacity = a_Opacity;
    v_RxRy = a_ZIndexStrokeWidth.zw;
  #else
    model = u_ModelMatrix;
    position = u_PositionSize.xy;
    size = u_PositionSize.zw;
    fillColor = u_FillColor;
    strokeColor = u_StrokeColor;
    zIndex = u_ZIndexStrokeWidth.x;
    strokeWidth = u_ZIndexStrokeWidth.y;
  #endif

  vec2 radius = size + vec2(strokeWidth / 2.0);

  v_FragCoord = vec2(a_FragCoord * radius / radius.y);
  v_Radius = radius;

  gl_Position = vec4((u_ProjectionMatrix 
    * u_ViewMatrix
    * model 
    * vec3(position + size * a_FragCoord, 1)).xy, zIndex, 1);
}
`;

export const frag = /* wgsl */ `
#ifdef USE_INSTANCES
#else
  layout(std140) uniform ShapeUniforms {
    mat3 u_ModelMatrix;
    vec4 u_PositionSize;
    vec4 u_FillColor;
    vec4 u_StrokeColor;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_Opacity;
  };
#endif

out vec4 outputColor;

in vec2 v_FragCoord;
#ifdef USE_INSTANCES
  in vec4 v_FillColor;
  in vec4 v_StrokeColor;
  in float v_StrokeWidth;
  in vec4 v_Opacity;
  in vec2 v_RxRy;
#else
#endif
in vec2 v_Radius;

float epsilon = 0.000001;

float sdf_circle(vec2 p, float r) {
  return length(p) - r;
}

float sdf_ellipse(vec2 p, vec2 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;

  // V1
  // float k1 = length(p/r);
  // return (k1-1.0)*min(r.x,r.y);

  // V3
  // float k1 = length(p/r);
  // return length(p)*(1.0-1.0/k1);
}

float sdf_rounded_box(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x>0.0)?r.xy : r.zw;
  r.x  = (p.y>0.0)?r.x  : r.y;
  vec2 q = abs(p)-b+r.x;
  return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r.x;
}

void main() {
  float strokeWidth;
  vec4 fillColor;
  vec4 strokeColor;
  float opacity;
  float fillOpacity;
  float strokeOpacity;
  float shape;
  vec2 rxRy;
  
  #ifdef USE_INSTANCES
    fillColor = v_FillColor;
    strokeColor = v_StrokeColor;
    strokeWidth = v_StrokeWidth;
    opacity = v_Opacity.x;
    fillOpacity = v_Opacity.y;
    strokeOpacity = v_Opacity.z;
    shape = v_Opacity.w;
    rxRy = v_RxRy;
  #else
    fillColor = u_FillColor;
    strokeColor = u_StrokeColor;
    strokeWidth = u_ZIndexStrokeWidth.y;
    opacity = u_Opacity.x;
    fillOpacity = u_Opacity.y;
    strokeOpacity = u_Opacity.z;
    shape = u_Opacity.w;
    rxRy = u_ZIndexStrokeWidth.zw;
  #endif

  vec2 r = (v_Radius - strokeWidth) / v_Radius.y;
  float wh = v_Radius.x / v_Radius.y;
  rxRy = rxRy / v_Radius.y;

  float dist = length(v_FragCoord);
  float antialiasedBlur = -fwidth(dist);

  float outerDistance;
  float innerDistance;
  // 'circle', 'ellipse', 'rect'
  if (shape < 0.5) {
    outerDistance = sdf_circle(v_FragCoord, 1.0);
    innerDistance = sdf_circle(v_FragCoord, r.x);
  } else if (shape < 1.5) {
    outerDistance = sdf_ellipse(v_FragCoord, vec2(wh, 1.0));
    innerDistance = sdf_ellipse(v_FragCoord, r);
  } else if (shape < 2.5) {
    outerDistance = sdf_rounded_box(v_FragCoord, vec2(wh, 1.0), vec4(rxRy, rxRy));
    innerDistance = sdf_rounded_box(v_FragCoord, r, vec4(rxRy, rxRy));
  }

  float opacity_t = clamp(outerDistance / antialiasedBlur, 0.0, 1.0);

  float color_t = strokeWidth < 0.01 ? 0.0 : smoothstep(
    antialiasedBlur,
    0.0,
    innerDistance
  );

  outputColor = mix(vec4(fillColor.rgb, fillColor.a * fillOpacity), strokeColor * strokeOpacity, color_t);
  outputColor.a = outputColor.a * opacity * opacity_t;

  if (outputColor.a < epsilon)
    discard;
}
`;
