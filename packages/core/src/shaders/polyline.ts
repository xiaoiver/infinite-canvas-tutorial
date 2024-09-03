export enum Location {
  ABCD,
  TX_TY,
  STROKE_COLOR,
  Z_INDEX_STROKE_WIDTH,
  OPACITY,
  PREV,
  POINTA,
  POINTB,
  NEXT,
  VERTEX_JOINT,
  VERTEX_NUM,
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

export const vert = /* wgsl */ `
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
};

layout(location = ${Location.PREV}) in vec2 a_Prev;
layout(location = ${Location.POINTA}) in vec2 a_PointA;
layout(location = ${Location.POINTB}) in vec2 a_PointB;
layout(location = ${Location.NEXT}) in vec2 a_Next;
layout(location = ${Location.VERTEX_JOINT}) in float a_VertexJoint;
layout(location = ${Location.VERTEX_NUM}) in float a_VertexNum;

#ifdef USE_INSTANCES
  layout(location = ${Location.ABCD}) in vec4 a_Abcd;
  layout(location = ${Location.TX_TY}) in vec2 a_Txty;
  layout(location = ${Location.STROKE_COLOR}) in vec4 a_StrokeColor;
  layout(location = ${Location.Z_INDEX_STROKE_WIDTH}) in vec4 a_ZIndexStrokeWidth;
  layout(location = ${Location.OPACITY}) in vec4 a_Opacity;
#else
  layout(std140) uniform ShapeUniforms {
    mat3 u_ModelMatrix;
    vec4 u_StrokeColor;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_Opacity;
  };
#endif

const float FILL = ${JointType.FILL}.0;
const float BEVEL = ${JointType.JOINT_BEVEL}.0;
const float MITER = ${JointType.JOINT_MITER}.0;
const float ROUND = ${JointType.JOINT_ROUND}.0;
const float JOINT_CAP_BUTT = ${JointType.JOINT_CAP_BUTT}.0;
const float JOINT_CAP_SQUARE = ${JointType.JOINT_CAP_SQUARE}.0;
const float JOINT_CAP_ROUND = ${JointType.JOINT_CAP_ROUND}.0;
const float FILL_EXPAND = 24.0;
const float CAP_BUTT = 1.0;
const float CAP_SQUARE = 2.0;
const float CAP_ROUND = 3.0;
const float CAP_BUTT2 = 4.0;

const float u_Expand = 1.0;
const float u_MiterLimit = 5.0;
const float u_ScaleMode = 0.0;
const float u_Alignment = 0.5;
const float u_DevicePixelRatio = 2.0;

out vec4 v_Distance;
out vec4 v_Arc;
out float v_Type;
out float v_ScalingFactor;

vec2 doBisect(
  vec2 norm, float len, vec2 norm2, float len2, float dy, float inner
) {
  vec2 bisect = (norm + norm2) / 2.0;
  bisect /= dot(norm, bisect);
  vec2 shift = dy * bisect;
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

void main() {
  mat3 model;
  vec4 strokeColor;
  float zIndex;
  float strokeWidth;

  #ifdef USE_INSTANCES
    model = mat3(a_Abcd.x, a_Abcd.y, 0, a_Abcd.z, a_Abcd.w, 0, a_Txty.x, a_Txty.y, 1);
    strokeColor = a_StrokeColor;
    zIndex = a_ZIndexStrokeWidth.x;
    strokeWidth = a_ZIndexStrokeWidth.y;
  #else
    model = u_ModelMatrix;
    strokeColor = u_StrokeColor;
    zIndex = u_ZIndexStrokeWidth.x;
    strokeWidth = u_ZIndexStrokeWidth.y;
  #endif

  vec2 pointA = (model * vec3(a_PointA, 1.0)).xy;
  vec2 pointB = (model * vec3(a_PointB, 1.0)).xy;

  vec2 xBasis = pointB - pointA;
  float len = length(xBasis);
  vec2 forward = xBasis / len;
  vec2 norm = vec2(forward.y, -forward.x);

  float type = a_VertexJoint;

  // if (u_ScaleMode > 2.5) {
  //   strokeWidth *= length(model * vec3(1.0, 0.0, 0.0));
  // } else if (u_ScaleMode > 1.5) {
  //   strokeWidth *= length(model * vec3(0.0, 1.0, 0.0));
  // } else if (u_ScaleMode > 0.5) {
  //   vec2 avgDiag = (model * vec3(1.0, 1.0, 0.0)).xy;
  //   strokeWidth *= sqrt(dot(avgDiag, avgDiag) * 0.5);
  // }
  float capType = floor(type / 32.0);
  type -= capType * 32.0;
  v_Arc = vec4(0.0);
  strokeWidth *= 0.5;
  float lineAlignment = 2.0 * u_Alignment - 1.0;

  vec2 pos;

  if (capType == CAP_ROUND) {
    if (a_VertexNum < 3.5) {
      gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    type = JOINT_CAP_ROUND;
    capType = 0.0;
  }

  if (type >= BEVEL) {
    float dy = strokeWidth + u_Expand;
    float inner = 0.0;
    if (a_VertexNum >= 1.5) {
      dy = -dy;
      inner = 1.0;
    }

    vec2 base, next, xBasis2, bisect;
    float flag = 0.0;
    float sign2 = 1.0;
    if (a_VertexNum < 0.5 || a_VertexNum > 2.5 && a_VertexNum < 3.5) {
      next = (model * vec3(a_Prev, 1.0)).xy;
      base = pointA;
      flag = type - floor(type / 2.0) * 2.0;
      sign2 = -1.0;
    } else {
      next = (model * vec3(a_Next, 1.0)).xy;
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

    if (abs(lineAlignment) > 0.01) {
      float shift = strokeWidth * lineAlignment;
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

    if (a_VertexNum < 3.5) {
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
        if (a_VertexNum < 0.5 || a_VertexNum > 2.5) {
          pos += back * (u_Expand + extra);
          dy2 = u_Expand;
        } else {
          dy2 = dot(pos + base - pointA, back) - extra;
        }
      }
      if (type >= JOINT_CAP_BUTT && type < JOINT_CAP_SQUARE + 0.5) {
        float extra = step(JOINT_CAP_SQUARE, type) * strokeWidth;
        if (a_VertexNum < 0.5 || a_VertexNum > 2.5) {
          dy3 = dot(pos + base - pointB, forward) - extra;
        } else {
          pos += forward * (u_Expand + extra);
          dy3 = u_Expand;
          if (capType >= CAP_BUTT) {
            dy2 -= u_Expand + extra;
          }
        }
      }
    } else if (type >= JOINT_CAP_ROUND && type < JOINT_CAP_ROUND + 1.5) {
      if (inner > 0.5) {
        dy = -dy;
        inner = 0.0;
      }
      vec2 d2 = abs(dy) * forward;
      if (a_VertexNum < 4.5) {
        dy = -dy;
        pos = dy * norm;
      } else if (a_VertexNum < 5.5) {
        pos = dy * norm;
      } else if (a_VertexNum < 6.5) {
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
        if (a_VertexNum < 4.5) {
          pos = doBisect(norm, len, norm2, len2, -dy, 1.0);
        } else if (a_VertexNum < 5.5) {
          pos = dy * norm;
        } else if (a_VertexNum > 7.5) {
          pos = dy * norm2;
        } else {
          pos = doBisect(norm, len, norm2, len2, dy, 0.0);
          float d2 = abs(dy);
          if (length(pos) > abs(dy) * 1.5) {
            if (a_VertexNum < 6.5) {
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
          if (length(pos) > abs(dy) * u_MiterLimit) {
            type = BEVEL;
          } else {
            if (a_VertexNum < 4.5) {
              dy = -dy;
              pos = doBisect(norm, len, norm2, len2, dy, 1.0);
            } else if (a_VertexNum < 5.5) {
              pos = dy * norm;
            } else if (a_VertexNum > 6.5) {
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
          if (a_VertexNum < 4.5) {
            pos = doBisect(norm, len, norm2, len2, -dy, 1.0);
          } else if (a_VertexNum < 5.5) {
            pos = dy * norm;
          } else if (a_VertexNum > 7.5) {
            pos = dy * norm2;
          } else {
            if (a_VertexNum < 6.5) {
              pos = pos3;
            } else {
              pos = pos4;
            }
          }
          vec2 norm3 = normalize(norm + norm2);
          float sign = step(0.0, dy) * 2.0 - 1.0;
          dy = -sign * dot(pos, norm);
          dy2 = -sign * dot(pos, norm2);
          dy3 = (-sign * dot(pos, norm3)) + strokeWidth;
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
    v_Distance = vec4(dy, dy2, dy3, strokeWidth) * u_DevicePixelRatio;
    v_Arc = v_Arc * u_DevicePixelRatio;
    // v_Travel = a_Travel + dot(pos - pointA, vec2(-norm.y, norm.x));
  }

  // v_ScalingFactor = sqrt(u_ModelMatrix[0][0] * u_ModelMatrix[0][0] + u_ModelMatrix[0][1] * u_ModelMatrix[0][1] + u_ModelMatrix[0][2] * u_ModelMatrix[0][2]);
  gl_Position = vec4((u_ProjectionMatrix 
    * u_ViewMatrix
    * model 
    * vec3(pos, 1)).xy, zIndex, 1);
}
`;

export const frag = /* wgsl */ `
#ifdef USE_INSTANCES
#else
  layout(std140) uniform ShapeUniforms {
    mat3 u_ModelMatrix;
    vec4 u_StrokeColor;
    vec4 u_ZIndexStrokeWidth;
    vec4 u_Opacity;
  };
#endif

out vec4 outputColor;

in vec4 v_Distance;
in vec4 v_Arc;
in float v_Type;
in float v_ScalingFactor;

float epsilon = 0.000001;

void main() {
  float alpha = 1.0;
  float strokeWidth = v_Arc.w;
  vec4 strokeColor = vec4(1.0, 0.0, 0.0, 1.0);
  float opacity = 1.0;
  float strokeOpacity = 1.0;

  if (v_Type < 0.5) {
    float left = max(v_Distance.x - 0.5, -v_Distance.w);
    float right = min(v_Distance.x + 0.5, v_Distance.w);
    float near = v_Distance.y - 0.5;
    float far = min(v_Distance.y + 0.5, 0.0);
    float top = v_Distance.z - 0.5;
    float bottom = min(v_Distance.z + 0.5, 0.0);
    alpha = max(right - left, 0.0) * max(bottom - top, 0.0) * max(far - near, 0.0);
  } else if (v_Type < 1.5) {
    float a1 = clamp(v_Distance.x + 0.5 - strokeWidth, 0.0, 1.0);
    float a2 = clamp(v_Distance.x + 0.5 + strokeWidth, 0.0, 1.0);
    float b1 = clamp(v_Distance.y + 0.5 - strokeWidth, 0.0, 1.0);
    float b2 = clamp(v_Distance.y + 0.5 + strokeWidth, 0.0, 1.0);
    alpha = a2 * b2 - a1 * b1;
  } else if (v_Type < 2.5) {
    alpha *= max(min(v_Distance.x + 0.5, 1.0), 0.0);
    alpha *= max(min(v_Distance.y + 0.5, 1.0), 0.0);
    alpha *= max(min(v_Distance.z + 0.5, 1.0), 0.0);
  } else if (v_Type < 3.5) {
    float a1 = clamp(v_Distance.x + 0.5 - strokeWidth, 0.0, 1.0);
    float a2 = clamp(v_Distance.x + 0.5 + strokeWidth, 0.0, 1.0);
    float b1 = clamp(v_Distance.y + 0.5 - strokeWidth, 0.0, 1.0);
    float b2 = clamp(v_Distance.y + 0.5 + strokeWidth, 0.0, 1.0);
    float alpha_miter = a2 * b2 - a1 * b1;
    float alpha_plane = max(min(v_Distance.z + 0.5, 1.0), 0.0);
    float d = length(v_Arc.xy);
    float circle_hor = max(min(v_Arc.w, d + 0.5) - max(-v_Arc.w, d - 0.5), 0.0);
    float circle_vert = min(v_Arc.w * 2.0, 1.0);
    float alpha_circle = circle_hor * circle_vert;
    alpha = min(alpha_miter, max(alpha_circle, alpha_plane));
  } else {
    float a1 = clamp(v_Distance.x + 0.5 - strokeWidth, 0.0, 1.0);
    float a2 = clamp(v_Distance.x + 0.5 + strokeWidth, 0.0, 1.0);
    float b1 = clamp(v_Distance.y + 0.5 - strokeWidth, 0.0, 1.0);
    float b2 = clamp(v_Distance.y + 0.5 + strokeWidth, 0.0, 1.0);
    alpha = a2 * b2 - a1 * b1;
    alpha *= max(min(v_Distance.z + 0.5, 1.0), 0.0);
  }

  outputColor = strokeColor;
  alpha = 1.0;
  outputColor.a *= alpha * opacity * strokeOpacity;
  if (outputColor.a < epsilon) {
    discard;
  }
}
`;
