import { ink } from './chunks/ink';
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
  vec4 u_DropShadowColor;
  vec4 u_DropShadow;
  vec2 u_AtlasSize;
};

${wireframe_vert_declaration}
layout(location = ${Location.POSITION}) in vec3 a_Position;
layout(location = ${Location.UV_OFFSET}) in vec4 a_UvOffset;

out vec2 v_Uv;

void main() {
  ${wireframe_vert}

  #ifdef USE_INSTANCES
    float zIndex = a_Position.z;
  #else
    float zIndex = u_ZIndexStrokeWidth.x;
  #endif

  float strokeWidth = u_ZIndexStrokeWidth.y;
  float fontSize = u_ZIndexStrokeWidth.z;
  float sizeAttenuation = u_Opacity.w;

  float scale = 1.0;
  if (sizeAttenuation > 0.5) {
    scale = 1.0 / u_ZoomScale;
  }

  v_Uv = a_UvOffset.xy / u_AtlasSize;
  vec2 offset = a_UvOffset.zw;

  gl_Position = vec4((u_ProjectionMatrix 
    * u_ViewMatrix
    * u_ModelMatrix 
    * vec3(a_Position.xy + offset, 1)).xy, zIndex, 1);
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
  vec4 u_DropShadowColor;
  vec4 u_DropShadow;
  vec2 u_AtlasSize;
};

out vec4 outputColor;

${wireframe_frag_declaration}
in vec2 v_Uv;
uniform sampler2D u_Texture;

float epsilon = 0.000001;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

#define SDF_PX 8.0

void main() {
  float strokeWidth = u_ZIndexStrokeWidth.y;
  vec4 fillColor = u_FillColor;
  vec4 strokeColor = u_StrokeColor;
  float opacity = u_Opacity.x;
  float fillOpacity = u_Opacity.y;
  float strokeOpacity = u_Opacity.z;
  float shapeSizeAttenuation = u_Opacity.w;
  vec4 dropShadow = u_DropShadow;
  vec4 dropShadowColor = u_DropShadowColor;
  float shadowDist;
  float shadowBlurRadius = u_DropShadow.z;
  
  #ifdef USE_SDF_NONE
    outputColor = texture(SAMPLER_2D(u_Texture), v_Uv);
  #else
    float dist;
    lowp float buff;
    vec2 shadowOffset = u_DropShadow.xy / u_AtlasSize;

    #ifdef USE_SDF
      #ifdef USE_EMOJI
        fillColor = texture(SAMPLER_2D(u_Texture), v_Uv);
      #endif
      dist = texture(SAMPLER_2D(u_Texture), v_Uv).a;
      buff = (256.0 - 64.0) / 256.0;

      #ifdef USE_SHADOW
        shadowDist = texture(SAMPLER_2D(u_Texture), v_Uv - shadowOffset).a;
      #endif
    #endif

    #ifdef USE_MSDF
      vec3 s = texture(SAMPLER_2D(u_Texture), v_Uv).rgb;
      dist = median(s.r, s.g, s.b);
      buff = 0.5;

      #ifdef USE_SHADOW
        vec3 shadowSample = texture(SAMPLER_2D(u_Texture), v_Uv - shadowOffset).rgb;
        shadowDist = median(shadowSample.r, shadowSample.g, shadowSample.b);
      #endif
    #endif

    float fontSize = u_ZIndexStrokeWidth.z;
    fillColor.a *= fillOpacity;
    strokeColor.a *= strokeOpacity;

    highp float gamma_scaled = fwidth(dist);
    if (strokeWidth > 0.0 && strokeColor.a > 0.0) {
      float fillAlpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist);      
      float strokeThreshold = buff - strokeWidth / fontSize;
      float strokeAlpha = smoothstep(strokeThreshold - gamma_scaled, strokeThreshold + gamma_scaled, dist);

      vec4 finalColor = mix(strokeColor, fillColor, fillAlpha);
      outputColor = finalColor;
      opacity *= strokeAlpha;
    } else {
      highp float alpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist);
      opacity *= alpha;
      outputColor = fillColor;
    }
  #endif
  
  outputColor.a *= opacity;

  #ifdef USE_SHADOW 
    // gamma_scaled = fwidth(shadowDist) * 128.0 / shadowBlurRadius;
    gamma_scaled = shadowBlurRadius / 128.0;
    highp float alpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, shadowDist);
    dropShadowColor.a *= alpha;
    outputColor = mix(dropShadowColor, outputColor, outputColor.a);
  #endif

  ${wireframe_frag}

  if (outputColor.a < epsilon)
    discard;
}
`;

export const physical_frag = /* wgsl */ `  
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
  vec4 u_DropShadowColor;
  vec4 u_DropShadow;
  vec2 u_AtlasSize;
};

out vec4 outputColor;

${wireframe_frag_declaration}
in vec2 v_Uv;
uniform sampler2D u_Texture;

float epsilon = 0.000001;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

${ink}

#define SDF_PX 8.0

void main() {
  float strokeWidth = u_ZIndexStrokeWidth.y;
  vec4 fillColor = u_FillColor;
  vec4 strokeColor = u_StrokeColor;
  float opacity = u_Opacity.x;
  float fillOpacity = u_Opacity.y;
  float strokeOpacity = u_Opacity.z;
  float shapeSizeAttenuation = u_Opacity.w;
  vec4 dropShadow = u_DropShadow;
  vec4 dropShadowColor = u_DropShadowColor;
  float shadowDist;
  float shadowBlurRadius = u_DropShadow.z;
  
  #ifdef USE_SDF_NONE
    outputColor = texture(SAMPLER_2D(u_Texture), v_Uv);
  #else
    float dist;
    lowp float buff;
    vec2 shadowOffset = u_DropShadow.xy / u_AtlasSize;

    #ifdef USE_SDF
      #ifdef USE_EMOJI
        fillColor = texture(SAMPLER_2D(u_Texture), v_Uv);
      #endif
      dist = texture(SAMPLER_2D(u_Texture), v_Uv).a;
      buff = (256.0 - 64.0) / 256.0;

      #ifdef USE_SHADOW
        shadowDist = texture(SAMPLER_2D(u_Texture), v_Uv - shadowOffset).a;
      #endif
    #endif

    #ifdef USE_MSDF
      vec3 s = texture(SAMPLER_2D(u_Texture), v_Uv).rgb;
      dist = median(s.r, s.g, s.b);
      buff = 0.5;

      #ifdef USE_SHADOW
        vec3 shadowSample = texture(SAMPLER_2D(u_Texture), v_Uv - shadowOffset).rgb;
        shadowDist = median(shadowSample.r, shadowSample.g, shadowSample.b);
      #endif
    #endif

    float fontSize = u_ZIndexStrokeWidth.z;

    highp float gamma_scaled;
    highp float alpha = ink(dist - 0.2, v_Uv);
    
    opacity *= alpha;

    outputColor = fillColor;
  #endif
  
  outputColor.a *= opacity;

  #ifdef USE_SHADOW 
    // gamma_scaled = fwidth(shadowDist) * 128.0 / shadowBlurRadius;
    gamma_scaled = shadowBlurRadius / 128.0;
    alpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, shadowDist);
    dropShadowColor.a *= alpha;
    outputColor = mix(dropShadowColor, outputColor, outputColor.a);
  #endif

  ${wireframe_frag}

  if (outputColor.a < epsilon)
    discard;
}
`;
