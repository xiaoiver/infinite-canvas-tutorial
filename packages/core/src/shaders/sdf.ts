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
  layout(location = 6) in vec4 a_InnerShadowColor;
  layout(location = 7) in vec4 a_InnerShadow;
#else
  layout(std140) uniform ShapeUniforms {
    mat3 u_ModelMatrix;
    vec4 u_PositionSize;
    vec4 u_FillColor;
    vec4 u_StrokeColor;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_Opacity;
    vec4 u_InnerShadowColor;
    vec4 u_InnerShadow;
  };
#endif

out vec2 v_FragCoord;
#ifdef USE_INSTANCES
  out vec4 v_FillColor;
  out vec4 v_StrokeColor;
  out float v_StrokeWidth;
  out vec4 v_Opacity;
  out float v_CornerRadius;
  out float v_StrokeAlignment;
  out vec4 v_InnerShadowColor;
  out vec4 v_InnerShadow;
#else
#endif
out vec2 v_Radius;

#ifdef USE_FILLIMAGE
  out vec2 v_Uv;
#endif

void main() {
  mat3 model;
  vec2 position;
  vec2 size;
  vec4 fillColor;
  vec4 strokeColor;
  float zIndex;
  float strokeWidth;
  float strokeAlignment;

  #ifdef USE_INSTANCES
    model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
    position = a_PositionSize.xy;
    size = a_PositionSize.zw;
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
    v_InnerShadowColor = a_InnerShadowColor;
    v_InnerShadow = a_InnerShadow;
  #else
    model = u_ModelMatrix;
    position = u_PositionSize.xy;
    size = u_PositionSize.zw;
    fillColor = u_FillColor;
    strokeColor = u_StrokeColor;
    zIndex = u_ZIndexStrokeWidth.x;
    strokeWidth = u_ZIndexStrokeWidth.y;
    strokeAlignment = u_ZIndexStrokeWidth.w;
  #endif

  float strokeOffset;
  if (strokeAlignment < 0.5) {
    strokeOffset = strokeWidth / 2.0;
  } else if (strokeAlignment < 1.5) {
    strokeOffset = 0.0;
  } else if (strokeAlignment < 2.5) {
    strokeOffset = strokeWidth;
  }

  vec2 radius = size + vec2(strokeOffset);

  v_FragCoord = vec2(a_FragCoord * radius);
  v_Radius = radius;

  #ifdef USE_FILLIMAGE
    v_Uv = (a_FragCoord * radius / size + 1.0) / 2.0;
  #endif

  gl_Position = vec4((u_ProjectionMatrix 
    * u_ViewMatrix
    * model 
    * vec3(position + v_FragCoord, 1)).xy, zIndex, 1);
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
    vec4 u_InnerShadowColor;
    vec4 u_InnerShadow;
  };
#endif

out vec4 outputColor;

in vec2 v_FragCoord;
#ifdef USE_INSTANCES
  in vec4 v_FillColor;
  in vec4 v_StrokeColor;
  in float v_StrokeWidth;
  in vec4 v_Opacity;
  in float v_CornerRadius;
  in float v_StrokeAlignment;
  in vec4 v_InnerShadowColor;
  in vec4 v_InnerShadow;
#else
#endif
in vec2 v_Radius;

#ifdef USE_FILLIMAGE
  in vec2 v_Uv;
  uniform sampler2D u_Texture;
#endif

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

float sdf_rounded_box(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

vec4 over(vec4 below, vec4 above) {
  vec4 result;
  float alpha = above.a + below.a * (1.0 - above.a);
  result.rgb =
      (above.rgb * above.a + below.rgb * below.a * (1.0 - above.a)) / alpha;
  result.a = alpha;
  return result;
}

float antialias(float distance) {
  return clamp(distance / -fwidth(distance), 0.0, 1.0);
}

vec4 mix_border_inside(vec4 border, vec4 inside, float distance) {
  // Blend the border on top of the background and then linearly interpolate
  // between the two as we slide inside the background.
  return mix(border, inside, clamp(1.0 - distance, 0.0, 1.0) * antialias(distance));
}

float sigmoid(float t) {
  return 1.0 / (1.0 + exp(-t));
}

float make_shadow(vec2 pos, vec2 halfSize, float cornerRd, float blurRd, float distMul, float shape) {
  float distance;
  if (shape < 0.5) {
    distance = sdf_circle(pos, halfSize.x);
  } else if (shape < 1.5) {
    distance = sdf_ellipse(pos, halfSize);
  } else if (shape < 2.5) {
    distance = sdf_rounded_box(pos, halfSize, cornerRd + blurRd);
  }
  float dist = sigmoid(distMul * distance / blurRd);
  return clamp(dist, 0.0, 1.0);
}

void main() {
  float strokeWidth;
  vec4 fillColor;
  vec4 strokeColor;
  float opacity;
  float fillOpacity;
  float strokeOpacity;
  float shape;
  float cornerRadius;
  vec4 innerShadowColor;
  vec4 innerShadow;
  float strokeAlignment;
  
  #ifdef USE_INSTANCES
    fillColor = v_FillColor;
    strokeColor = v_StrokeColor;
    strokeWidth = v_StrokeWidth;
    opacity = v_Opacity.x;
    fillOpacity = v_Opacity.y;
    strokeOpacity = v_Opacity.z;
    shape = v_Opacity.w;
    cornerRadius = v_CornerRadius;
    strokeAlignment = v_StrokeAlignment;
    innerShadowColor = v_InnerShadowColor;
    innerShadow = v_InnerShadow;
  #else
    fillColor = u_FillColor;
    strokeColor = u_StrokeColor;
    strokeWidth = u_ZIndexStrokeWidth.y;
    opacity = u_Opacity.x;
    fillOpacity = u_Opacity.y;
    strokeOpacity = u_Opacity.z;
    shape = u_Opacity.w;
    cornerRadius = u_ZIndexStrokeWidth.z;
    strokeAlignment = u_ZIndexStrokeWidth.w;
    innerShadowColor = u_InnerShadowColor;
    innerShadow = u_InnerShadow;
  #endif

  #ifdef USE_FILLIMAGE
    bool useFillImage = innerShadow.w > 0.5;
    if (useFillImage) {
      fillColor = texture(SAMPLER_2D(u_Texture), v_Uv);
    }
  #endif

  float distance;
  // 'circle', 'ellipse', 'rect'
  if (shape < 0.5) {
    distance = sdf_circle(v_FragCoord, v_Radius.x);
  } else if (shape < 1.5) {
    distance = sdf_ellipse(v_FragCoord, v_Radius);
  } else if (shape < 2.5) {
    distance = sdf_rounded_box(v_FragCoord, v_Radius, cornerRadius);
    // TODO: Fast path when the quad is not rounded and doesn't have any border.
  }

  // based on the target alpha compositing mode.
  fillColor.a *= fillOpacity;
  strokeColor.a *= strokeOpacity;

  vec4 color = fillColor;
  if (strokeWidth > 0.0) {
    float d1;
    float d2;
    if (strokeAlignment < 0.5) {
      d1 = distance + strokeWidth;
      d2 = distance + strokeWidth / 2.0;
      color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
      color = mix_border_inside(strokeColor, color, d2);
    } else if (strokeAlignment < 1.5) {
      d1 = distance + strokeWidth;
      d2 = distance;
      color = mix_border_inside(over(fillColor, strokeColor), fillColor, d1);
      color = mix_border_inside(strokeColor, color, d2);
    } else if (strokeAlignment < 2.5) {
      d2 = distance + strokeWidth;
      color = mix_border_inside(strokeColor, color, d2);
    }
  }
  outputColor = color;

  float innerShadowBlurRadius = innerShadow.z / 2.0;
  if (innerShadowBlurRadius > 0.0) {
    vec2 shadowOffset = -innerShadow.xy;
    float blurRadius = innerShadow.z;
    float distMul = -1.0;
    float lowerShadow = make_shadow(v_FragCoord + shadowOffset, v_Radius, cornerRadius, blurRadius, distMul, shape);

    vec3 lowerShadowColor = innerShadowColor.rgb * innerShadowColor.a;
    outputColor = over(vec4(color.xyz, 1.0), vec4(lowerShadowColor, 1.0 - lowerShadow));
    outputColor = over(outputColor, vec4(color.xyz, clamp(distance, 0.0, 1.0)));
  }

  float antialiasedBlur = -fwidth(length(v_FragCoord));
  float opacity_t = clamp(distance / antialiasedBlur, 0.0, 1.0);
  outputColor.a *= clamp(1.0 - distance, 0.0, 1.0) * opacity * opacity_t;

  if (outputColor.a < epsilon)
    discard;
}
`;
