import {
  vert as wireframe_vert,
  vert_declaration as wireframe_vert_declaration,
  frag as wireframe_frag,
  frag_declaration as wireframe_frag_declaration,
  Location as WireframeLocation,
} from './wireframe';

export enum Location {
  BARYCENTRIC = WireframeLocation.BARYCENTRIC,
  POSITION = 1,
  UV_OFFSET = 2,
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

layout(std140) uniform ShapeUniforms {
  mat3 u_ModelMatrix;
  vec4 u_FillColor;
  vec4 u_StrokeColor;
  vec4 u_ZIndexStrokeWidth;
  vec4 u_Opacity;
  vec2 u_AtlasSize;
};

${wireframe_vert_declaration}
layout(location = ${Location.POSITION}) in vec2 a_Position;
layout(location = ${Location.UV_OFFSET}) in vec4 a_UvOffset;

out vec2 v_Uv;

void main() {
  ${wireframe_vert}

  float zIndex = u_ZIndexStrokeWidth.x;
  float strokeWidth = u_ZIndexStrokeWidth.y;
  float fontSize = u_ZIndexStrokeWidth.z;
  float sizeAttenuation = u_Opacity.w;

  float scale = 1.0;
  if (sizeAttenuation > 0.5) {
    scale = 1.0 / u_ZoomScale;
  }

  v_Uv = a_UvOffset.xy / u_AtlasSize;
  float fontScale = fontSize / 24.;
  vec2 offset = a_UvOffset.zw * fontScale;

  gl_Position = vec4((u_ProjectionMatrix 
    * u_ViewMatrix
    * u_ModelMatrix 
    * vec3(a_Position + offset, 1)).xy, zIndex, 1);
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

layout(std140) uniform ShapeUniforms {
  mat3 u_ModelMatrix;
  vec4 u_FillColor;
  vec4 u_StrokeColor;
  vec4 u_ZIndexStrokeWidth;
  vec4 u_Opacity;
  vec2 u_AtlasSize;
};

out vec4 outputColor;

${wireframe_frag_declaration}
in vec2 v_Uv;
uniform sampler2D u_Texture;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

float epsilon = 0.000001;

#define SDF_PX 8.0

void main() {
  float strokeWidth = u_ZIndexStrokeWidth.y;
  vec4 fillColor = u_FillColor;
  vec4 strokeColor = u_StrokeColor;
  float opacity = u_Opacity.x;
  float fillOpacity = u_Opacity.y;
  float strokeOpacity = u_Opacity.z;
  float shapeSizeAttenuation = u_Opacity.w;

  #ifdef USE_MSDF
    vec3 s = texture(SAMPLER_2D(u_Texture), v_Uv).rgb;
    float dist = median(s.r, s.g, s.b);
  #else
    float dist = texture(SAMPLER_2D(u_Texture), v_Uv).a;
  #endif

  float fontSize = u_ZIndexStrokeWidth.z;

  float fontScale = fontSize / 24.0;
  lowp float buff = (256.0 - 64.0) / 256.0;
  // float opacity = u_FillOpacity;
  // if (u_HasStroke > 0.5 && u_StrokeWidth > 0.0) {
  //   color = u_StrokeColor;
  //   buff = (6.0 - u_StrokeWidth / fontScale / 2.0) / SDF_PX;
  //   opacity = u_StrokeOpacity;
  // }

  highp float gamma_scaled = fwidth(dist);
  highp float alpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist);

  opacity *= alpha;
  
  outputColor = fillColor;
  outputColor.a *= opacity;

  ${wireframe_frag}

  if (outputColor.a < epsilon)
    discard;
}
`;
