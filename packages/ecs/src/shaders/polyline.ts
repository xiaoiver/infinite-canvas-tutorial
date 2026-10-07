import {
  vert as wireframe_vert,
  vert_declaration as wireframe_vert_declaration,
  frag as wireframe_frag,
  frag_declaration as wireframe_frag_declaration,
  Location as WireframeLocation,
} from './wireframe';

export enum Location {
  BARYCENTRIC = WireframeLocation.BARYCENTRIC,
  PREV = 1,
  POINTA = 2,
  POINTB = 3,
  NEXT = 4,
  VERTEX_JOINT = 5,
  VERTEX_NUM = 6,
  TRAVEL = 7,
}

export enum JointType {
  NONE = 0,
  FILL = 1,
  JOINT_BEVEL = 4,
  JOINT_MITER = 8,
  JOINT_ROUND = 12,
  JOINT_CAP_BUTT = 16,
  JOINT_CAP_SQUARE = 18,
  JOINT_CAP_ROUND = 20,
  FILL_EXPAND = 24,
  CAP_BUTT = 1 << 5,
  CAP_SQUARE = 2 << 5,
  CAP_ROUND = 3 << 5,
  CAP_BUTT2 = 4 << 5,
}

/** WebGPU / naga 转 WGSL 不支持 inverse(mat3)，用手写伴随矩阵求逆。 */

export const vert = /* wgsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  vec4 u_BackgroundColor;
  vec4 u_GridColor;
  float u_ZoomScale;
  float u_CheckboardStyle;
  vec2 u_Viewport;
};

${wireframe_vert_declaration}
layout(location = ${Location.PREV}) in vec2 a_Prev;
layout(location = ${Location.POINTA}) in vec2 a_PointA;
layout(location = ${Location.POINTB}) in vec2 a_PointB;
layout(location = ${Location.NEXT}) in vec2 a_Next;
layout(location = ${Location.VERTEX_JOINT}) in float a_VertexJoint;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum;
layout(location = ${Location.TRAVEL}) in vec3 a_Travel;

layout(std140) uniform ShapeUniforms {
  mat3 u_ModelMatrix;
  vec4 u_StrokeColor;
  vec4 u_ZIndexStrokeWidth;
  vec4 u_Opacity;
  vec4 u_StrokeDash;
  vec4 u_StrokeUVRect;
};

const float FILL = ${JointType.FILL}.0;
const float BEVEL = ${JointType.JOINT_BEVEL}.0;
const float MITER = ${JointType.JOINT_MITER}.0;
const float ROUND = ${JointType.JOINT_ROUND}.0;
const float JOINT_CAP_BUTT = ${JointType.JOINT_CAP_BUTT}.0;
const float JOINT_CAP_SQUARE = ${JointType.JOINT_CAP_SQUARE}.0;
const float JOINT_CAP_ROUND = ${JointType.JOINT_CAP_ROUND}.0;
const float FILL_EXPAND = ${JointType.FILL_EXPAND}.0;
const float CAP_BUTT = 1.0;
const float CAP_SQUARE = 2.0;
const float CAP_ROUND = 3.0;
const float CAP_BUTT2 = 4.0;

const float expand = 1.0;
const float dpr = 2.0;

out vec4 v_Distance;
out vec4 v_Arc;
out float v_Type;
out vec2 v_DashPosition;
out vec4 v_DashSegment;
out vec4 v_DashPrevious;
out vec4 v_DashNext;
#ifdef USE_STROKE_GRADIENT
out vec2 v_StrokeUv;
#endif
#ifdef USE_INSTANCES
  out vec4 v_StrokeColor;
  out vec4 v_Opacity;
  out float v_StrokeAlignment;
#else
#endif

vec2 doBisect(
  vec2 norm, float len, vec2 norm2, float len2, float dy, float inner
) {
  vec2 bisect = (norm + norm2) / 2.0;
  bisect /= dot(norm, bisect);
  if (inner > 0.5) {
    if (len < len2) {
      if (abs(dy * (bisect.x * norm.y - bisect.y * norm.x)) > len) {
        return dy * norm;
      }
    } else {
      if (abs(dy * (bisect.x * norm2.y - bisect.y * norm2.x)) > len2) {
        return dy * norm;
      }
    }
  }
  return dy * bisect;
}

mat3 inverseMat3(mat3 m) {
  float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
  float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
  float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];

  float b01 = a22 * a11 - a12 * a21;
  float b11 = -a22 * a10 + a12 * a20;
  float b21 = a21 * a10 - a11 * a20;

  float det = a00 * b01 + a01 * b11 + a02 * b21;
  if (abs(det) < 1e-12) {
    return mat3(1.0);
  }
  return mat3(
    b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),
    b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),
    b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)
  ) / det;
}

// vec2 clip2ScreenSpace(vec4 clip) {
//   return u_Viewport * (0.5 * clip.xy / clip.w + 0.5);
// }

void main() {
  ${wireframe_vert}

  mat3 model = u_ModelMatrix;
  vec4 strokeColor = u_StrokeColor;
  float zIndex = u_ZIndexStrokeWidth.x;
  float strokeWidth = u_ZIndexStrokeWidth.y;
  float strokeMiterlimit = u_ZIndexStrokeWidth.z;
  float strokeAlignment = u_ZIndexStrokeWidth.w;
  bool strokeAttenuation = u_Opacity.w > 0.5;

  if (strokeAttenuation) {
    strokeWidth /= u_ZoomScale;
  }

  vec2 pointA;
  vec2 pointB;
  // vec4 clip0 = vec4((u_ProjectionMatrix 
  //   * u_ViewMatrix
  //   * model
  //   * vec3(a_PointA, 1)).xy, zIndex, 1);;
  // vec4 clip1 = vec4((u_ProjectionMatrix 
  //   * u_ViewMatrix
  //   * model
  //   * vec3(a_PointB, 1)).xy, zIndex, 1);;

  // if (sizeAttenuation) {
  //   pointA = clip2ScreenSpace(clip0);
  //   pointB = clip2ScreenSpace(clip1);
  // } else {
    pointA = (model * vec3(a_PointA, 1.0)).xy;
    pointB = (model * vec3(a_PointB, 1.0)).xy;
  // }

  vec2 xBasis = pointB - pointA;
  float len = length(xBasis);
  vec2 forward = xBasis / len;
  vec2 norm = vec2(forward.y, -forward.x);

  float type = a_VertexJoint;
  float vertexNum = a_VertexNum;

  float capType = floor(type / 32.0);
  type -= capType * 32.0;
  if (type < BEVEL && capType != CAP_ROUND) {
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  v_Arc = vec4(0.0);
  strokeWidth *= 0.5;
  float strokeAlignmentFactor = 2.0 * strokeAlignment - 1.0;

  vec2 pos;

  if (capType == CAP_ROUND) {
    // This extra instance runs backwards to draw the first endpoint.
    strokeAlignmentFactor = -strokeAlignmentFactor;
    if (vertexNum < 3.5) {
      gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    type = JOINT_CAP_ROUND;
    capType = 0.0;
  }

  if (type >= BEVEL) {
    float dy = strokeWidth + expand;
    float inner = 0.0;
    if (vertexNum >= 1.5) {
      dy = -dy;
      inner = 1.0;
    }

    vec2 base, next, xBasis2, bisect;
    float flag = 0.0;
    float sign2 = 1.0;
    if (vertexNum < 0.5 || vertexNum > 2.5 && vertexNum < 3.5) {
      // if (sizeAttenuation) {
      //   next = clip2ScreenSpace(vec4((u_ProjectionMatrix 
      //     * u_ViewMatrix
      //     * model
      //     * vec3(a_Prev, 1)).xy, zIndex, 1));
      // } else {
        next = (model * vec3(a_Prev, 1.0)).xy;
      // }

      base = pointA;
      flag = type - floor(type / 2.0) * 2.0;
      sign2 = -1.0;
    } else {
      // if (sizeAttenuation) {
      //   next = clip2ScreenSpace(vec4((u_ProjectionMatrix 
      //     * u_ViewMatrix
      //     * model
      //     * vec3(a_Next, 1)).xy, zIndex, 1));
      // } else {
        next = (model * vec3(a_Next, 1.0)).xy;
      // }

      base = pointB;
      if (type >= MITER && type < MITER + 3.5) {
        flag = step(MITER + 1.5, type);
        // check miter limit here?
      }
    }

    xBasis2 = next - base;
    float len2 = length(xBasis2);
    vec2 norm2 = vec2(xBasis2.y, -xBasis2.x) / len2;
    float D = norm.x * norm2.y - norm.y * norm2.x;
    if (D < 0.0) {
      inner = 1.0 - inner;
    }
    norm2 *= sign2;

    if (abs(strokeAlignmentFactor) > 0.01) {
      float shift = strokeWidth * strokeAlignmentFactor;
      pointA += norm * shift;
      pointB += norm * shift;
      if (abs(D) < 0.01) {
        base += norm * shift;
      } else {
        base += doBisect(norm, len, norm2, len2, shift, 0.0);
      }
    }

    float collinear = step(0.0, dot(norm, norm2));
    v_Type = 0.0;
    float dy2 = -1000.0;
    float dy3 = -1000.0;
    if (abs(D) < 0.01 && collinear < 0.5) {
      if (type >= ROUND && type < ROUND + 1.5) {
        type = JOINT_CAP_ROUND;
      }
      // TODO: BUTT here too
    }

    if (vertexNum < 3.5) {
      if (abs(D) < 0.01) {
        pos = dy * norm;
      } else {
        if (flag < 0.5 && inner < 0.5) {
          pos = dy * norm;
        } else {
          pos = doBisect(norm, len, norm2, len2, dy, inner);
        }
      }
      if (capType >= CAP_BUTT && capType < CAP_ROUND) {
        float extra = step(CAP_SQUARE, capType) * strokeWidth;
        vec2 back = -forward;
        if (vertexNum < 0.5 || vertexNum > 2.5) {
          pos += back * (expand + extra);
          dy2 = expand;
        } else {
          dy2 = dot(pos + base - pointA, back) - extra;
        }
      }
      if (type >= JOINT_CAP_BUTT && type < JOINT_CAP_SQUARE + 0.5) {
        float extra = step(JOINT_CAP_SQUARE, type) * strokeWidth;
        if (vertexNum < 0.5 || vertexNum > 2.5) {
          dy3 = dot(pos + base - pointB, forward) - extra;
        } else {
          pos += forward * (expand + extra);
          dy3 = expand;
          if (capType >= CAP_BUTT) {
            dy2 -= expand + extra;
          }
        }
      }
    } else if (type >= JOINT_CAP_ROUND && type < JOINT_CAP_ROUND + 1.5) {
      if (inner > 0.5) {
        dy = -dy;
        inner = 0.0;
      }
      vec2 d2 = abs(dy) * forward;
      if (vertexNum < 4.5) {
        dy = -dy;
        pos = dy * norm;
      } else if (vertexNum < 5.5) {
        pos = dy * norm;
      } else if (vertexNum < 6.5) {
        pos = dy * norm + d2;
        v_Arc.x = abs(dy);
      } else {
        dy = -dy;
        pos = dy * norm + d2;
        v_Arc.x = abs(dy);
      }
      dy2 = 0.0;
      v_Arc.y = dy;
      v_Arc.z = 0.0;
      v_Arc.w = strokeWidth;
      v_Type = 3.0;
    } else if (abs(D) < 0.01) {
      pos = dy * norm;
    } else {
      if (type >= ROUND && type < ROUND + 1.5) {
        if (inner > 0.5) {
          dy = -dy;
          inner = 0.0;
        }
        if (vertexNum < 4.5) {
          pos = doBisect(norm, len, norm2, len2, -dy, 1.0);
        } else if (vertexNum < 5.5) {
          pos = dy * norm;
        } else if (vertexNum > 7.5) {
          pos = dy * norm2;
        } else {
          pos = doBisect(norm, len, norm2, len2, dy, 0.0);
          float d2 = abs(dy);
          if (length(pos) > abs(dy) * 1.5) {
            if (vertexNum < 6.5) {
              pos.x = dy * norm.x - d2 * norm.y;
              pos.y = dy * norm.y + d2 * norm.x;
            } else {
              pos.x = dy * norm2.x + d2 * norm2.y;
              pos.y = dy * norm2.y - d2 * norm2.x;
            }
          }
        }
        vec2 norm3 = normalize(norm + norm2);

        float sign = step(0.0, dy) * 2.0 - 1.0;
        v_Arc.x = sign * dot(pos, norm3);
        v_Arc.y = pos.x * norm3.y - pos.y * norm3.x;
        v_Arc.z = dot(norm, norm3) * strokeWidth;
        v_Arc.w = strokeWidth;

        dy = -sign * dot(pos, norm);
        dy2 = -sign * dot(pos, norm2);
        dy3 = v_Arc.z - v_Arc.x;
        v_Type = 3.0;
      } else {
        float hit = 0.0;
        if (type >= BEVEL && type < BEVEL + 1.5) {
          if (dot(norm, norm2) > 0.0) {
            type = MITER;
          }
        }
        if (type >= MITER && type < MITER + 3.5) {
          if (inner > 0.5) {
            dy = -dy;
            inner = 0.0;
          }
          float sign = step(0.0, dy) * 2.0 - 1.0;
          pos = doBisect(norm, len, norm2, len2, dy, 0.0);
          if (length(pos) > abs(dy) * strokeMiterlimit) {
            type = BEVEL;
          } else {
            if (vertexNum < 4.5) {
              dy = -dy;
              pos = doBisect(norm, len, norm2, len2, dy, 1.0);
            } else if (vertexNum < 5.5) {
              pos = dy * norm;
            } else if (vertexNum > 6.5) {
              pos = dy * norm2;
            }
            v_Type = 1.0;
            dy = -sign * dot(pos, norm);
            dy2 = -sign * dot(pos, norm2);
            hit = 1.0;
          }
        }
        if (type >= BEVEL && type < BEVEL + 1.5) {
          if (inner > 0.5) {
            dy = -dy;
            inner = 0.0;
          }
          float d2 = abs(dy);
          vec2 pos3 = vec2(dy * norm.x - d2 * norm.y, dy * norm.y + d2 * norm.x);
          vec2 pos4 = vec2(dy * norm2.x + d2 * norm2.y, dy * norm2.y - d2 * norm2.x);
          if (vertexNum < 4.5) {
            pos = doBisect(norm, len, norm2, len2, -dy, 1.0);
          } else if (vertexNum < 5.5) {
            pos = dy * norm;
          } else if (vertexNum > 7.5) {
            pos = dy * norm2;
          } else {
            if (vertexNum < 6.5) {
              pos = pos3;
            } else {
              pos = pos4;
            }
          }
          vec2 norm3 = normalize(norm + norm2);
          float sign = step(0.0, dy) * 2.0 - 1.0;
          dy = -sign * dot(pos, norm);
          dy2 = -sign * dot(pos, norm2);
          dy3 = (-sign * dot(pos, norm3)) + strokeWidth * dot(norm, norm3);
          v_Type = 4.0;
          hit = 1.0;
        }
        if (hit < 0.5) {
          gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }
      }
    }
    pos += base;
    v_Distance = vec4(dy, dy2, dy3, strokeWidth) * dpr;
    v_Arc *= dpr;
  }

  // Carry segment frames, not a single extrapolated travel coordinate. At a
  // corner the incoming and outgoing directions have different projections.
  vec2 dashA = (model * vec3(a_PointA, 1.0)).xy;
  vec2 dashB = (model * vec3(a_PointB, 1.0)).xy;
  vec2 dashPrev = (model * vec3(a_Prev, 1.0)).xy;
  vec2 dashNext = (model * vec3(a_Next, 1.0)).xy;
  bool startCap = floor(a_VertexJoint / 32.0) == CAP_ROUND;
  float localLength = length(a_PointB - a_PointA);
  float previousLength = length(a_PointA - a_Prev);
  float nextLength = length(a_Next - a_PointB);
  // The dedicated round start-cap instance runs in the reverse direction.
  if (startCap) {
    v_DashPosition = pos - dashB;
    v_DashSegment = vec4(dashA - dashB, 0.0, localLength);
    v_DashPrevious = vec4(0.0, 0.0, 0.0, -1.0);
    v_DashNext = vec4(0.0, 0.0, 0.0, -1.0);
  } else {
    v_DashPosition = pos - dashA;
    v_DashSegment = vec4(dashB - dashA, a_Travel.x, localLength);
    v_DashPrevious = vec4(dashA - dashPrev, previousLength,
      a_Travel.y);
    v_DashNext = vec4(dashNext - dashB, nextLength,
      a_Travel.z);
  }

#ifdef USE_STROKE_GRADIENT
  vec3 localH = inverseMat3(model) * vec3(pos, 1.0);
  v_StrokeUv = (localH.xy - u_StrokeUVRect.xy) * u_StrokeUVRect.zw;
#endif

  // if (sizeAttenuation) {
  //   vec4 clip = mix(clip0, clip1, 0.5);
  //   gl_Position = vec4(clip.w * (2.0 * pos / u_Viewport - 1.0), clip.z, clip.w);
  // } else {
    gl_Position = vec4((u_ProjectionMatrix 
      * u_ViewMatrix
      * vec3(pos, 1)).xy, zIndex, 1);
  // }
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
  vec2 u_Viewport;
};

layout(std140) uniform ShapeUniforms {
  mat3 u_ModelMatrix;
  vec4 u_StrokeColor;
  vec4 u_ZIndexStrokeWidth;
  vec4 u_Opacity;
  vec4 u_StrokeDash;
  vec4 u_StrokeUVRect;
};

out vec4 outputColor;

${wireframe_frag_declaration}
in vec4 v_Distance;
in vec4 v_Arc;
in float v_Type;
in vec2 v_DashPosition;
in vec4 v_DashSegment;
in vec4 v_DashPrevious;
in vec4 v_DashNext;
#ifdef USE_STROKE_GRADIENT
in vec2 v_StrokeUv;
uniform sampler2D u_Texture;
#endif

float epsilon = 0.000001;

float antialias(float distance) {
  return clamp(distance / max(fwidth(distance), 0.0001), 0.0, 1.0);
}

float pixelLine(float x) {
  return clamp(x + 0.5, 0.0, 1.0);
}
// float pixelLine(float x, float A, float B) {
//   float y = abs(x), s = sign(x);
//   if (y * 2.0 < A - B) {
//       return 0.5 + s * y / A;
//   }
//   y -= (A - B) * 0.5;
//   y = max(1.0 - y / B, 0.0);
//   return (1.0 + s * (1.0 - y * y)) * 0.5;
//   //return clamp(x + 0.5, 0.0, 1.0);
// }

// Signed distance to a painted interval, clipped to this centerline segment.
float dashIntervalDistance(vec2 p, vec2 segment, float localLength,
  float travel, float cell, float dash, float period, float offset,
  float radius, float cap, float startJoint, float endJoint) {
  float worldLength = length(segment);
  if (worldLength < 0.0001 || localLength < 0.0001) return 1.0e6;
  float rawStart = cell * period - offset - travel;
  float rawEnd = rawStart + dash;
  float start = max(0.0, rawStart);
  float end = min(localLength, rawEnd);
  if (start >= localLength || end < start || (end == start && dash > 0.0) || (dash == 0.0 && cap < 0.5)) return 1.0e6;
  vec2 direction = segment / worldLength;
  float along = dot(p, direction);
  float across = dot(p, vec2(-direction.y, direction.x))
    + radius * (2.0 * u_ZIndexStrokeWidth.w - 1.0);
  float scale = worldLength / localLength;
  float outside = max(start * scale - along, along - end * scale);
  // A dash crossing a vertex has a join, not two artificial caps.
  float edgeCap = cap;
  if (along < start * scale && start == 0.0 && startJoint > 0.5) edgeCap = 0.0;
  if (along > end * scale && end == localLength && endJoint > 0.5) edgeCap = 0.0;
  if (edgeCap > 1.5) {
    return length(vec2(max(outside, 0.0), across)) - radius;
  }
  float extension = edgeCap > 0.5 ? radius : 0.0;
  vec2 q = vec2(outside - extension, abs(across) - radius);
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0);
}

float dashedSegmentDistance(vec2 p, vec2 segment, float localLength,
  float travel, float dash, float period, float offset, float radius, float cap, float startJoint, float endJoint) {
  float worldLength = length(segment);
  if (worldLength < 0.0001 || localLength < 0.0001) return 1.0e6;
  float along = clamp(dot(p, segment) / (worldLength * worldLength), 0.0, 1.0) * localLength;
  float cell = floor((along + travel + offset) / period);
  float distance = dashIntervalDistance(p, segment, localLength, travel, cell,
    dash, period, offset, radius, cap, startJoint, endJoint);
  // The closest dash can be in a neighboring cell, including a partial dash
  // at a path endpoint. Dash intervals are evaluated entirely in the shader.
  distance = min(distance, dashIntervalDistance(p, segment, localLength, travel, cell - 1.0,
    dash, period, offset, radius, cap, startJoint, endJoint));
  return min(distance, dashIntervalDistance(p, segment, localLength, travel, cell + 1.0,
    dash, period, offset, radius, cap, startJoint, endJoint));
}

vec2 dashCoverage() {
  float attenuation = u_Opacity.w > 0.5 ? u_ZoomScale : 1.0;
  float dash = u_StrokeDash.x / attenuation;
  float gap = u_StrokeDash.y / attenuation;
  float period = dash + gap;
  if (period <= 0.0 || gap <= 0.0) return vec2(0.0, 1.0);
  float offset = u_StrokeDash.z / attenuation;
  float cap = u_StrokeDash.w;
  float radius = u_ZIndexStrokeWidth.y * 0.5 / attenuation;
  vec2 p = v_DashPosition;
  vec2 segment = v_DashSegment.xy;
  float travel = v_DashSegment.z;
  float localLength = v_DashSegment.w;
  float startPhase = mod(travel + offset, period);
  float previousPhase = mod(v_DashPrevious.w + v_DashPrevious.z + offset, period);
  float endPhase = mod(travel + localLength + offset, period);
  float nextPhase = mod(v_DashNext.w + offset, period);
  float startJoin = v_DashPrevious.w >= 0.0 && previousPhase > 0.0001 && previousPhase <= dash
    && startPhase < dash - 0.0001 ? 1.0 : 0.0;
  float endJoin = v_DashNext.w >= 0.0 && endPhase > 0.0001 && endPhase <= dash
    && nextPhase < dash - 0.0001 ? 1.0 : 0.0;
  // Open path endpoints keep linecap (including VectorNetwork overrides),
  // independently of the caps on internal dash intervals.
  if (v_DashPrevious.w < 0.0 && dot(p, segment) < 0.0 && startPhase < dash) {
    return vec2(0.0, 1.0);
  }
  if (v_DashNext.w < 0.0 && dot(p - segment, segment) > 0.0 && endPhase > 0.0 && endPhase <= dash) {
    return vec2(0.0, 1.0);
  }
  float distance = dashedSegmentDistance(p, segment, localLength, travel,
    dash, period, offset, radius, cap, startJoin, endJoin);
  if (v_DashPrevious.w >= 0.0) {
    distance = min(distance, dashedSegmentDistance(p + v_DashPrevious.xy,
      v_DashPrevious.xy, v_DashPrevious.z, v_DashPrevious.w,
      dash, period, offset, radius, cap, 0.0, startJoin));
  }
  float join = 0.0;
  if (v_DashNext.w >= 0.0) {
    distance = min(distance, dashedSegmentDistance(p - segment,
      v_DashNext.xy, v_DashNext.z, v_DashNext.w,
      dash, period, offset, radius, cap, endJoin, 0.0));
    // Only paint the outer join when one dash crosses the vertex. A gap or
    // a dash ending exactly at the vertex must not leave a solid join wedge.
    vec2 q = p - segment;
    if (endJoin > 0.5 &&
        dot(q, segment) > 0.0 && dot(q, v_DashNext.xy) < 0.0) {
      join = 1.0;
    }
  }
  return vec2(clamp(0.5 - distance / max(fwidth(distance), 0.0001), 0.0, 1.0), join);
}

void main() {
#ifdef USE_STROKE_GRADIENT
  vec4 strokeColor = texture(SAMPLER_2D(u_Texture), v_StrokeUv);
#else
  vec4 strokeColor = u_StrokeColor;
#endif
  float opacity = u_Opacity.x;
  float strokeOpacity = u_Opacity.z;
  bool strokeAttenuation = u_Opacity.w > 0.5;
  float strokeAlignment = u_ZIndexStrokeWidth.w;
  float alpha = 1.0;

  float d1 = v_Distance.x;
  float d2 = v_Distance.y;
  float d3 = v_Distance.z;
  float w = v_Distance.w;

  if (v_Type < 0.5) {
    float left = max(d1 - 0.5, -w);
    float right = min(d1 + 0.5, w);
    // Avoid cancellation of large clipping sentinels on mediump GPUs.
    alpha = antialias(right - left) * pixelLine(-d2) * pixelLine(-d3);
  } else if (v_Type < 1.5) {
    float a1 = pixelLine(d1 - w);
    float a2 = pixelLine(d1 + w);
    float b1 = pixelLine(d2 - w);
    float b2 = pixelLine(d2 + w);

    float left = max(d1 - 0.5, -w);
    float right = min(d1 + 0.5, w);
    
    alpha = antialias(a2 * b2 - a1 * b1);
  } else if (v_Type < 2.5) {
    alpha *= max(min(d1 + 0.5, 1.0), 0.0);
    alpha *= max(min(d2 + 0.5, 1.0), 0.0);
    alpha *= max(min(d3 + 0.5, 1.0), 0.0);
  } else if (v_Type < 3.5) {
    float a1 = pixelLine(d1 - w);
    float a2 = pixelLine(d1 + w);
    float b1 = pixelLine(d2 - w);
    float b2 = pixelLine(d2 + w);
    float alpha_miter = a2 * b2 - a1 * b1;
    float alpha_bevel = pixelLine(d3);
    
    float r = length(v_Arc.xy);
    float circle_hor = pixelLine(w + r) - pixelLine(-w + r);
    float circle_vert = min(w * 2.0, 1.0);
    float alpha_circle = circle_hor * circle_vert;
    alpha = min(alpha_miter, max(alpha_circle, alpha_bevel));
  } else {
    float a1 = pixelLine(d1 - w);
    float a2 = pixelLine(d1 + w);
    float b1 = pixelLine(d2 - w);
    float b2 = pixelLine(d2 + w);
    alpha = antialias(a2 * b2 - a1 * b1);
    alpha *= pixelLine(d3);
  }

  vec2 dashed = dashCoverage();
  alpha = max(dashed.x, alpha * dashed.y);

  outputColor = strokeColor;
  outputColor.a *= alpha * opacity * strokeOpacity;

  ${wireframe_frag}
  
  #ifndef USE_STENCIL
  if (outputColor.a < epsilon) {
    discard;
  }
  #endif
}
`;
