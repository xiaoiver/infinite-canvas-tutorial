export enum Location {
  FRAG_COORD,
  ABCD,
  TXTY,
  POSITION_SIZE,
  ZINDEX_STROKE_WIDTH,
  DROP_SHADOW_COLOR,
  DROP_SHADOW,
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

layout(location = ${Location.FRAG_COORD}) in vec2 a_FragCoord;

#ifdef USE_INSTANCES
  layout(location = ${Location.ABCD}) in vec4 a_Abcd;
  layout(location = ${Location.TXTY}) in vec2 a_Txty;
  layout(location = ${Location.POSITION_SIZE}) in vec4 a_PositionSize;
  layout(location = ${Location.ZINDEX_STROKE_WIDTH}) in vec4 a_ZIndexStrokeWidth;
  layout(location = ${Location.DROP_SHADOW_COLOR}) in vec4 a_DropShadowColor;
  layout(location = ${Location.DROP_SHADOW}) in vec4 a_DropShadow;
#else
  layout(std140) uniform ShapeUniforms {
    mat3 u_ModelMatrix;
    vec4 u_PositionSize;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_DropShadowColor;
    vec4 u_DropShadow;
  };
#endif

out vec2 v_Origin;
#ifdef USE_INSTANCES
  out float v_CornerRadius;
  out vec4 v_DropShadowColor;
  out vec4 v_DropShadow;
#else
#endif
out vec2 v_Size;
out vec2 v_Point;

void main() {
  mat3 model;
  vec2 origin;
  vec2 size;
  float zIndex;
  vec4 dropShadow;

  #ifdef USE_INSTANCES
    model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
    origin = a_PositionSize.xy;
    size = a_PositionSize.zw;
    zIndex = a_ZIndexStrokeWidth.x;
    dropShadow = a_DropShadow;
    v_CornerRadius = a_ZIndexStrokeWidth.z;
    v_DropShadowColor = a_DropShadowColor;
    v_DropShadow = dropShadow;
  #else
    model = u_ModelMatrix;
    origin = u_PositionSize.xy;
    size = u_PositionSize.zw;
    zIndex = u_ZIndexStrokeWidth.x;
    dropShadow = u_DropShadow;
  #endif

  // Set the bounds of the shadow and adjust its size based on the shadow's
  // spread radius to achieve the spreading effect
  float margin = 3.0 * dropShadow.z;
  origin += dropShadow.xy;
  v_Origin = origin;
  v_Size = size;

  origin -= margin;
  size += 2.0 * margin;
  vec2 center = origin + size / 2.0;
  v_Point = center + a_FragCoord * (size / 2.0);

  gl_Position = vec4((u_ProjectionMatrix 
    * u_ViewMatrix
    * model 
    * vec3(v_Point, 1)).xy, zIndex, 1);
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
    vec4 u_PositionSize;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_DropShadowColor;
    vec4 u_DropShadow;
  };
#endif

out vec4 outputColor;

in vec2 v_Origin;
#ifdef USE_INSTANCES
  in float v_CornerRadius;
  in vec4 v_DropShadowColor;
  in vec4 v_DropShadow;
#else
#endif
in vec2 v_Size;
in vec2 v_Point;

float epsilon = 0.000001;
float PI = 3.1415926;

// A standard gaussian function, used for weighting samples
float gaussian(float x, float sigma) {
  return exp(-(x * x) / (2. * sigma * sigma)) / (sqrt(2. * PI) * sigma);
}

// This approximates the error function, needed for the gaussian integral
vec2 erf(vec2 x) {
  vec2 s = sign(x), a = abs(x);
  x = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
  x *= x;
  return s - s / (x * x);
}

// @see https://raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html
// vec2 erf7(vec2 x) {
//   x = x * sqrt(2. * PI);
//   vec2 xx = x * x;
//   x = x + (0.24295 + (0.03395 + 0.0104 * xx) * xx) * (x * xx);
//   return x / sqrt(1.0 + x * x);
// }

float rect_shadow(vec2 pixel_position, vec2 origin, vec2 size, float sigma) {
  vec2 bottom_right = origin + size;
  vec2 x_distance = vec2(pixel_position.x - origin.x, pixel_position.x - bottom_right.x);
  vec2 y_distance = vec2(pixel_position.y - origin.y, pixel_position.y - bottom_right.y);
  vec2 integral_x = 0.5 + 0.5 * erf(x_distance * (sqrt(0.5) / sigma));
  vec2 integral_y = 0.5 + 0.5 * erf(y_distance * (sqrt(0.5) / sigma));
  return (integral_x.x - integral_x.y) * (integral_y.x - integral_y.y);
}

float blur_along_x(float x, float y, float sigma, float corner, vec2 half_size) {
  float delta = min(half_size.y - corner - abs(y), 0.0);
  float curved = half_size.x - corner + sqrt(max(0., corner * corner - delta * delta));
  vec2 integral = 0.5 + 0.5 * erf((x + vec2(-curved, curved)) * (sqrt(0.5) / sigma));
  return integral.y - integral.x;
}

void main() {
  float cornerRadius;
  vec4 dropShadow;
  vec4 dropShadowColor;
  
  #ifdef USE_INSTANCES
    cornerRadius = v_CornerRadius;
    dropShadowColor = v_DropShadowColor;
    dropShadow = v_DropShadow;
  #else
    cornerRadius = u_ZIndexStrokeWidth.z;
    dropShadowColor = u_DropShadowColor;
    dropShadow = u_DropShadow;
  #endif

  float blur_radius = dropShadow.z;
  if (blur_radius > 0.0) {
    float alpha = 0.;
    vec2 point = v_Point;
    
    if (cornerRadius > 0.0) {
      vec2 half_size = v_Size / 2.0;
      vec2 center = v_Origin + half_size;
      vec2 center_to_point = point - center;

      // The signal is only non-zero in a limited range, so don't waste samples
      float low = center_to_point.y - half_size.y;
      float high = center_to_point.y + half_size.y;
      float start = clamp(-3. * blur_radius, low, high);
      float end = clamp(3. * blur_radius, low, high);

      // Accumulate samples (we can get away with surprisingly few samples)
      float step = (end - start) / 4.;
      float y = start + step * 0.5;
      
      for (int i = 0; i < 4; i++) {
        alpha += blur_along_x(center_to_point.x, center_to_point.y - y, blur_radius,
                              cornerRadius, half_size) *
                gaussian(y, blur_radius) * step;
        y += step;
      }
    } else {
      alpha = rect_shadow(point, v_Origin, v_Size, blur_radius);
    }

    outputColor = dropShadowColor;
    outputColor.a = alpha;
  } else {
    discard;
  }
}
`;
