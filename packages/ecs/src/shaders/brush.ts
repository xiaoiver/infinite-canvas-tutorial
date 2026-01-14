/**
 * @see https://github.com/ShenCiao/Ciallo/blob/main/docs/shaders/articulatedLine.vert
 */

import { fbm } from './chunks/fbm';
import {
  vert as wireframe_vert,
  vert_declaration as wireframe_vert_declaration,
  frag as wireframe_frag,
  frag_declaration as wireframe_frag_declaration,
  Location as WireframeLocation,
} from './wireframe';

export enum Location {
  BARYCENTRIC = WireframeLocation.BARYCENTRIC,
  POINTA = 1,
  POINTB = 2,
  VERTEX_NUM = 3,
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
  
  ${wireframe_vert_declaration}
  layout(location = ${Location.POINTA}) in vec4 a_PointA;
  layout(location = ${Location.POINTB}) in vec4 a_PointB;
  layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum;
  
  layout(std140) uniform ShapeUniforms {
    mat3 u_ModelMatrix;
    vec4 u_StrokeColor;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_Opacity;
    vec4 u_Stamp;
  };

  out vec2 p0;
  out float r0;
  out float l0;
  out vec2 p1;
  out float r1;
  out float l1;
  out vec2 p;
  
  void main() {
    ${wireframe_vert}
  
    mat3 model;
    vec4 fillColor;
    vec4 strokeColor;
    float zIndex;
    float strokeWidth;

    model = u_ModelMatrix;
    strokeColor = u_StrokeColor;
    zIndex = u_ZIndexStrokeWidth.x;
    strokeWidth = u_ZIndexStrokeWidth.y;

    p0 = a_PointA.xy;
    r0 = a_PointA.z;
    l0 = a_PointA.w;
    p1 = a_PointB.xy;
    r1 = a_PointB.z;
    l1 = a_PointB.w;

    vec2 tangentDirection = normalize(p1 - p0);
    vec2 normalDirection = vec2(-tangentDirection.y, tangentDirection.x);
    float cosTheta = (r0 - r1)/distance(p0, p1);
    if(abs(cosTheta) >= 1.0) return; 

    vec2 tangent = normalize(p1 - p0);
    vec2 normal = vec2(-tangent.y, tangent.x);

    float vertexNum = a_VertexNum;

    vec2 position;
    vec2 offsetSign;
    float r;
    if (vertexNum < 0.5) {
      position = p0;
      r = r0;
      offsetSign = vec2(-1.0, -1.0);
    } else if (vertexNum < 1.5) {
      position = p0;
      r = r0;
      offsetSign = vec2(-1.0, 1.0);
    } else if (vertexNum < 2.5) {
      position = p1;
      r = r1;
      offsetSign = vec2(1.0, 1.0);
    } else if (vertexNum < 3.5) {
      position = p1;
      r = r1;
      offsetSign = vec2(1.0, -1.0);
    }

    // Apply the half angle formula from cos(theta) to tan(theta/2)
    float tanHalfTheta = sqrt((1.0+cosTheta) / (1.0-cosTheta));
    float cotHalfTheta = 1.0 / tanHalfTheta;
    float normalTanValue = vec4(tanHalfTheta, tanHalfTheta, cotHalfTheta, cotHalfTheta)[gl_VertexID];
    // Corner case: The small circle is very close to the big one, casuing large offset in the normal direction, discard the edge
    if(normalTanValue > 10.0 || normalTanValue < 0.1) return;
    
    vec2 trapzoidVertexPosition = position + 
        offsetSign.x * r * tangentDirection + 
        offsetSign.y * r * normalDirection * normalTanValue;
    p = trapzoidVertexPosition;
  
    gl_Position = vec4((u_ProjectionMatrix 
      * u_ViewMatrix
      * model 
      * vec3(trapzoidVertexPosition, 1)).xy, zIndex, 1);
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
    vec4 u_StrokeColor;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_Opacity;
    vec4 u_Stamp;
  };
  
  ${wireframe_frag_declaration}
  
  in vec2 p0;
  in float r0;
  in float l0;
  in vec2 p1;
  in float r1;
  in float l1;
  in vec2 p;

  #ifdef USE_FILLIMAGE
    uniform sampler2D u_Texture;
  #endif

  out vec4 outputColor;
  
  float epsilon = 0.000001;

  const int EquiDistance = 0, RatioDistance = 1;

  float x2n(float x){
    float stampInterval = u_Stamp.x;
    int stampMode = int(u_Stamp.w);
    if(stampMode == EquiDistance) return x / stampInterval;
    if(stampMode == RatioDistance){
      float L = distance(p0, p1);
      if(r0 == r1) return x/(stampInterval*r0);
      else return -L / stampInterval / (r0 - r1) * log(1.0 - (1.0 - r1/r0)/L * x);
    }
  }

  float n2x(float n){
    float stampInterval = u_Stamp.x;
    int stampMode = int(u_Stamp.w);
    if(stampMode == EquiDistance) return n * stampInterval;
    if(stampMode == RatioDistance){
      float L = distance(p0, p1);
      if(r0 == r1) return n * stampInterval * r0;
      else return L * (1.0-exp(-(r0-r1)*n*stampInterval/L)) / (1.0-r1/r0);
    }
  }

  mat2 rotate(float angle){
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  ${fbm}
  
  void main() {
    float strokeWidth;
    vec4 strokeColor;
    float opacity;
    float strokeOpacity;
    float brushType;
    
    strokeColor = u_StrokeColor;
    strokeWidth = u_ZIndexStrokeWidth.y;
    brushType = u_ZIndexStrokeWidth.z;
    opacity = u_Opacity.x;
    strokeOpacity = u_Opacity.z;

    vec2 tangent = normalize(p1 - p0);
    vec2 normal = vec2(-tangent.y, tangent.x);

    // The local coordinate orgin at p0, x axis along the tangent direct.
    float len = distance(p1, p0);
    vec2 pLocal = vec2(dot(p-p0, tangent), dot(p-p0, normal));
    vec2 p0Local = vec2(0, 0);
    vec2 p1Local = vec2(len, 0);

    float cosTheta = (r0 - r1)/len;
    float d0 = distance(p, p0);
    float d0cos = pLocal.x / d0;
    float d1 = distance(p, p1);
    float d1cos = (pLocal.x - len) / d1;

    // Remove corners
    if(d0cos < cosTheta && d0 > r0) discard;
    if(d1cos > cosTheta && d1 > r1) discard;
    
    vec4 color = strokeColor;

    if (brushType < 0.5) {
      // Vanilla brush
      if(d0 < r0 && d1 < r1) discard;
      float A = (d0 < r0 || d1 < r1) ? 1.0 - sqrt(1.0 - color.a) : color.a;
      outputColor = vec4(color.rgb, A);
      return;
    } else if (brushType < 1.5) {
      // Stamp brush
      // The method here is not published yet, it should be explained in a 10min video.
      // The footprint is a disk instead of a square.
      // We set a quadratic polynomial to calculate the effect range, the range on polyline edge footprint can touch the current pixel.
      // Two roots of the quadratic polynomial are the effectRangeFront and effectRangeBack.
      // Formulas from SIGGRAPH 2022 Talk - A Fast & Robust Solution for Cubic & Higher-Order Polynomials
      // The quadratic equation
      float a, b, c, delta;
      a = 1.0 - pow(cosTheta, 2.0);
      b = 2.0 * (r0 * cosTheta - pLocal.x);
      c = pow(pLocal.x, 2.0) + pow(pLocal.y, 2.0) - pow(r0, 2.0);
      delta = pow(b, 2.0) - 4.0*a*c;
      if(delta <= 0.0) discard; // This should never happen.
      
      // Solve the quadratic equation
      // Need to learn how to solve a quadratic equation? Check this talk by Cem Yuksel:
      // https://www.youtube.com/watch?v=ok0EZ0fBCMA
      float tempMathBlock = b + sign(b) * sqrt(delta);
      float x1 = -2.0 * c / tempMathBlock;
      float x2 = -tempMathBlock / (2.0*a);
      float effectRangeFront = x1 <= x2 ? x1 : x2;
      float effectRangeBack = x1 > x2 ? x1 : x2;

      float stampInterval = u_Stamp.x;
      float noiseFactor = u_Stamp.y;
      float rotationFactor = u_Stamp.z;

      // With the distance to the polyline's first vertex, we can compute a "stamp index" value.
      // which indicate the number of stamps from the first vertex to current point.
      // We stamp on polyline every time the stamp index comes to an integer.
      float index0 = l0/stampInterval; // The stamp index of vertex0.
      float startIndex, endIndex;
      if (effectRangeFront <= 0.0){
          startIndex = ceil(index0);
      }
      else{
          startIndex = ceil(index0 + x2n(effectRangeFront));
      }
      float index1 = l1/stampInterval;
      float backIndex = x2n(effectRangeBack) + index0;
      endIndex = index1 < backIndex ? index1 : backIndex;
      if(startIndex > endIndex) discard;

      // The main loop to sample and blend color from the footprint, from startIndex to endIndex
      int MAX_i = 128; float currIndex = startIndex;
      float A = 0.0;
      // vec4 currColor = vec4(0.0,0.0,0.0,1e-10);    // set alpha as 1e-10 to avoid numerical error
      for(int i = 0; i < MAX_i; i++){
          float currStampLocalX = n2x(currIndex - index0);
          // Apply roation and sample the footprint.
          vec2 pToCurrStamp = pLocal - vec2(currStampLocalX, 0.0);
          float currStampRadius = r0 - cosTheta * currStampLocalX;
          float angle = rotationFactor*radians(360.0*fract(sin(currIndex)*1.0));
          pToCurrStamp *= rotate(angle);
          vec2 textureCoordinate = (pToCurrStamp/currStampRadius + 1.0)/2.0;

          float opacity = 1.0;
          #ifdef USE_FILLIMAGE
            opacity = texture(SAMPLER_2D(u_Texture), textureCoordinate).a;
          #endif
          // Blend opacity.
          float opacityNoise = noiseFactor*fbm(textureCoordinate*50.0);
          opacity = clamp(opacity - opacityNoise, 0.0, 1.0) * color.a;
          A = A * (1.0-opacity) + opacity;

          currIndex += 1.0;
          if(currIndex > endIndex) break;
      }
      if(A < 1e-4) discard;
      outputColor = vec4(color.rgb, A);
    }
  
    ${wireframe_frag}
  }
  `;
