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
  GLYPH_BOUNDS = 3,
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
  vec4 u_FillUVRect;
};

${wireframe_vert_declaration}
layout(location = ${Location.POSITION}) in vec3 a_Position;
layout(location = ${Location.UV_OFFSET}) in vec4 a_UvOffset;
layout(location = ${Location.GLYPH_BOUNDS}) in vec4 a_GlyphBounds;

out vec2 v_Uv;
out vec4 v_GlyphBounds;
#ifdef USE_FILLIMAGE
out vec2 v_FillUv;
#endif

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
  v_GlyphBounds = a_GlyphBounds / vec4(u_AtlasSize, u_AtlasSize);
  vec2 offset = a_UvOffset.zw;

  vec2 localPos = a_Position.xy + offset * scale;
#ifdef USE_FILLIMAGE
  // Render-to-texture uses framebuffer/texture row order vs. our top-down local UVs; flip V
  // so filtered RGBA matches on-screen SDF orientation (same issue as mesh FillImage from GPU RT).
  v_FillUv = (localPos - u_FillUVRect.xy) * u_FillUVRect.zw;
  v_FillUv.y = 1.0 - v_FillUv.y;
#endif

  gl_Position = vec4((u_ProjectionMatrix 
    * u_ViewMatrix
    * u_ModelMatrix 
    * vec3(localPos, 1)).xy, zIndex, 1);
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
  vec4 u_FillUVRect;
};

out vec4 outputColor;

${wireframe_frag_declaration}
in vec2 v_Uv;
in vec4 v_GlyphBounds;
#ifdef USE_FILLIMAGE
in vec2 v_FillUv;
#endif
uniform sampler2D u_Texture;

float epsilon = 0.000001;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

#define SDF_PX 8.0

void main() {
#ifdef USE_FILLIMAGE
  outputColor = texture(SAMPLER_2D(u_Texture), v_FillUv);
  outputColor.a *= u_Opacity.x;
  ${wireframe_frag}
  if (outputColor.a < epsilon)
    discard;
#else
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
      #ifdef USE_SDF
        // One screen pixel can span multiple atlas texels at small zoom levels.
        // Sample a centered 3x3 footprint. A 2x2 grid can miss a thin stroke
        // between its rows (notably the waist of '8') and leave a bright seam.
        vec2 uvDx = dFdx(v_Uv);
        vec2 uvDy = dFdy(v_Uv);
        float footprint = max(length(uvDx * u_AtlasSize), length(uvDy * u_AtlasSize));
        if (footprint > 2.5) {
          vec2 lo = v_GlyphBounds.xy + 0.5 / u_AtlasSize;
          vec2 hi = v_GlyphBounds.zw - 0.5 / u_AtlasSize;
          float width = max(gamma_scaled * 0.5, 1.0 / 256.0);
          uvDx /= 3.0;
          uvDy /= 3.0;
          float filteredAlpha = (1.0 / 9.0) * (
            smoothstep(buff - width, buff + width, texture(SAMPLER_2D(u_Texture), clamp(v_Uv - uvDx - uvDy, lo, hi)).a) +
            smoothstep(buff - width, buff + width, texture(SAMPLER_2D(u_Texture), clamp(v_Uv        - uvDy, lo, hi)).a) +
            smoothstep(buff - width, buff + width, texture(SAMPLER_2D(u_Texture), clamp(v_Uv + uvDx - uvDy, lo, hi)).a) +
            smoothstep(buff - width, buff + width, texture(SAMPLER_2D(u_Texture), clamp(v_Uv - uvDx,        lo, hi)).a) +
            smoothstep(buff - width, buff + width, texture(SAMPLER_2D(u_Texture), clamp(v_Uv,               lo, hi)).a) +
            smoothstep(buff - width, buff + width, texture(SAMPLER_2D(u_Texture), clamp(v_Uv + uvDx,        lo, hi)).a) +
            smoothstep(buff - width, buff + width, texture(SAMPLER_2D(u_Texture), clamp(v_Uv - uvDx + uvDy, lo, hi)).a) +
            smoothstep(buff - width, buff + width, texture(SAMPLER_2D(u_Texture), clamp(v_Uv        + uvDy, lo, hi)).a) +
            smoothstep(buff - width, buff + width, texture(SAMPLER_2D(u_Texture), clamp(v_Uv + uvDx + uvDy, lo, hi)).a)
          );
          alpha = mix(alpha, filteredAlpha, smoothstep(2.5, 3.5, footprint));
        }
      #endif
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
#endif
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
  vec4 u_FillUVRect;
};

out vec4 outputColor;

${wireframe_frag_declaration}
in vec2 v_Uv;
#ifdef USE_FILLIMAGE
in vec2 v_FillUv;
#endif
uniform sampler2D u_Texture;

float epsilon = 0.000001;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

${ink}

#define SDF_PX 8.0

void main() {
#ifdef USE_FILLIMAGE
  outputColor = texture(SAMPLER_2D(u_Texture), v_FillUv);
  outputColor.a *= u_Opacity.x;
  ${wireframe_frag}
  if (outputColor.a < epsilon)
    discard;
#else
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
#endif
}
`;
