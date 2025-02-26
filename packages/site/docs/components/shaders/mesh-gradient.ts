import { simplex_3d } from './simplex-3d';

export const vert = /* wgsl */ `
#define MAX_POINTS 10

struct Point {
  vec3 color;
  vec2 position;
};

layout(std140) uniform Uniforms {
  Point u_Points[MAX_POINTS];
  vec3 u_BgColor;
  float u_PointsNum;
  float u_NoiseRatio;
  float u_NoiseTime;
  float u_WarpShapeIndex;
  float u_WarpSize;
  float u_WarpRatio;
  float u_GradientTypeIndex;
  float u_Time;
};

layout(location = 0) in vec2 a_Position;

out vec2 v_TexCoord;

void main() {
  v_TexCoord = 0.5 * (a_Position + 1.0);
  gl_Position = vec4(a_Position, 0.0, 1.0);

  #ifdef VIEWPORT_ORIGIN_TL
    v_TexCoord.y = 1.0 - v_TexCoord.y;
  #endif
}
`;

export const frag = /* wgsl */ `
#define MAX_POINTS 10

struct Point {
  vec3 color;
  vec2 position;
};

layout(std140) uniform Uniforms {
  Point u_Points[MAX_POINTS];
  vec3 u_BgColor;
  float u_PointsNum;
  float u_NoiseRatio;
  float u_NoiseTime;
  float u_WarpShapeIndex;
  float u_WarpSize;
  float u_WarpRatio;
  float u_GradientTypeIndex;
  float u_Time;
};

in vec2 v_TexCoord;

out vec4 outputColor;

float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

${simplex_3d}

// Value Noise with increased contrast
float valueNoise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = rand(i);
  float b = rand(i + vec2(1.0, 0.0));
  float c = rand(i + vec2(0.0, 1.0));
  float d = rand(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float n = mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  // Increase contrast

  return (n - 0.5) * 2.0;
}
// Worley Noise with inverted and scaled output
float worleyNoise(vec2 st) {
  vec2 i_st = floor(st);
  vec2 f_st = fract(st);
  float m_dist = 1.0;
  for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
          vec2 neighbor = vec2(float(x), float(y));
          vec2 point = vec2(rand(i_st + neighbor), rand(i_st + neighbor + vec2(12.9898, 78.233)));
          vec2 diff = neighbor + point - f_st;
          float dist = length(diff);
          m_dist = min(m_dist, dist);
      }

  }
  // Invert and scale the output
  return (1.0 - m_dist) * 2.0;
}
float fbm(vec2 st) {
  const int OCTAVES = 6;
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 0.0;
  // Lacunarity: Increase in frequency with each octave

  float lacunarity = 2.0;
  // Gain: Decrease in amplitude with each octave

  float gain = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    value += amplitude * valueNoise(st);
    st *= lacunarity;
    amplitude *= gain;
  }
  return value;
}
// Voronoi Noise
float voronoiNoise(vec2 st) {
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);
    float m_dist = 1.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = vec2(rand(i_st + neighbor), rand(i_st + neighbor + vec2(1.0)));
            point = 0.5 + 0.5 * sin(u_Time + 6.2831 * point);
            vec2 diff = neighbor + point - f_st;
            float dist = length(diff);
            m_dist = min(m_dist, dist);
        }

    }
    return m_dist;
}
// Domain Warping
vec2 domainWarp(vec2 p) {
    float n1 = snoise(vec3(p + u_Time * 0.1, 0.0));
    float n2 = snoise(vec3(p + u_Time * 0.1 + 5.0, 0.0));
    return vec2(p.x + n1 * 0.2, p.y + n2 * 0.2);
}
// Smooth layered sine waves
float wavesNoise(vec2 st) {
    float noise = 0.0;

    // Layer 1: Primary waves

    vec2 pos1 = st * 3.0;
    noise += sin(pos1.x + u_Time * 0.2) * 0.5 + 0.5;
    noise += sin(pos1.y + u_Time * 0.2) * 0.5 + 0.5;

    // Layer 2: Secondary waves at different angle

    vec2 pos2 = vec2(
    st.x * cos(0.7854) - st.y * sin(0.7854), st.x * sin(0.7854) + st.y * cos(0.7854)
    ) * 4.0;
    noise += sin(pos2.x) * 0.25 + 0.25;
    noise += sin(pos2.y) * 0.25 + 0.25;
    return noise / 3.0;
}
// Gradient noise with controlled smoothness
float smoothGradient(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);

  // Smoother interpolation

  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = rand(i);
  float b = rand(i + vec2(1.0, 0.0));
  float c = rand(i + vec2(0.0, 1.0));
  float d = rand(i + vec2(1.0, 1.0));
  float noise = mix(
  mix(a, b, u.x), mix(c, d, u.x), u.y
  );
  return noise * 0.8 + 0.1; // Adjust contrast
}
// Sphere effect
float sphereNoise(vec2 st) {
  vec2 center = vec2(0.5);
  float dist = distance(st, center);

  // Create smooth sphere falloff

  float sphere = 1.0 - smoothstep(0.0, 0.5, dist);

  // Add subtle movement

  float angle = atan(st.y - 0.5, st.x - 0.5);
  float movement = sin(angle * 2.0 + u_Time * 0.2) * 0.02;
  return sphere + movement;
}
// Stepped rows effect
float rowsNoise(vec2 st) {
  // Number of rows
  float rows = 15.0;

  // Create base row pattern

  float y = st.y * rows;
  float row = floor(y);

  // Add horizontal offset based on row number

  float offset = row * 0.1;
  float x = st.x + offset;

  // Add movement

  float movement = sin(u_Time * 0.2 + row * 0.5) * 0.02;
  x += movement;

  // Smooth stepping between rows

  float smoothRow = smoothstep(0.0, 0.1, fract(y));
  return mix(x, x + 0.1, smoothRow);
}
float columnsNoise(vec2 st) {
  // Number of columns
  float cols = 15.0;

  // Create base column pattern

  float x = st.x * cols;
  float col = floor(x);

  // Add vertical offset based on column number

  float offset = col * 0.1;
  float y = st.y + offset;

  // Add movement

  float movement = sin(u_Time * 0.2 + col * 0.5) * 0.02;
  y += movement;

  // Smooth stepping between columns

  float smoothCol = smoothstep(0.0, 0.1, fract(x));
  return mix(y, y + 0.1, smoothCol);
}
// Flat/Stable pattern - minimal movement
float flatNoise(vec2 st) {
  // Create a very subtle, stable pattern
  float pattern = sin(st.x * 2.0) * 0.02 + cos(st.y * 2.0) * 0.02;
  return pattern;
}
float blackHoleNoise(vec2 st) {
  vec2 center = vec2(0.5);
  float dist = distance(st, center);

  // Calculate angle for spiral effect

  float angle = atan(st.y - center.y, st.x - center.x);

  // Wider, more gradual falloff

  float pull = 1.0 - smoothstep(0.0, 1.5, dist);

  // Gentler spiral effect

  float spiral = angle + u_Time * 0.1;

  // Layer multiple subtle distortions

  float distortion = 0.0;
  distortion += sin(spiral * 2.0 + dist * 4.0) * 0.3;
  distortion += cos(spiral * 1.5 - dist * 3.0) * 0.2;

  // Combine with pull for smoother falloff

  distortion *= pull * pull;

  // Add subtle secondary vortex

  float secondaryDist = distance(st, center + vec2(0.2, 0.0));
  float secondaryPull = 1.0 - smoothstep(0.0, 1.2, secondaryDist);
  float secondarySpiral = angle + u_Time * 0.08;
  distortion += sin(secondarySpiral * 1.5) * secondaryPull * 0.15;
  return distortion;
}

vec2 applyWarpShape(vec2 st, float warpSize, float time) {
  vec2 warp;
  if (int(u_WarpShapeIndex) == 0) {
    warp = vec2(snoise(vec3(st * warpSize, time)));
  } else if (int(u_WarpShapeIndex) == 1) {
    warp = vec2(sin(length(st-0.5)*warpSize + time), cos(length(st-0.5)*warpSize + time)) * 0.5;
  } else if (int(u_WarpShapeIndex) == 2) {
    warp = vec2(valueNoise(st*warpSize + time * 0.5)) * 0.5;
  } else if (int(u_WarpShapeIndex) == 3) {
    warp = vec2(worleyNoise(st*warpSize + time * 0.5)) * 0.5;
  } else if (int(u_WarpShapeIndex) == 4) {
    warp = vec2(fbm(st*warpSize + time * 0.2)) * 0.4;
  } else if (int(u_WarpShapeIndex) == 5) {
    warp = vec2(voronoiNoise(st*warpSize + time * 0.2)) * 0.5;
  } else if (int(u_WarpShapeIndex) == 6) {
    warp = vec2(domainWarp(st*warpSize) * 0.5);
  } else if (int(u_WarpShapeIndex) == 7) {
    warp = vec2(wavesNoise(st*warpSize + time * 0.1)) * 0.4;
  } else if (int(u_WarpShapeIndex) == 8) {
    warp = vec2(smoothGradient(st*warpSize + time * 0.1)) * 0.5;
  } else if (int(u_WarpShapeIndex) == 9) {
    warp = vec2(sphereNoise(st)) * warpSize * 0.8;
  } else if (int(u_WarpShapeIndex) == 10) {
    warp = vec2(rowsNoise(st)) * warpSize * 0.5;
  } else if (int(u_WarpShapeIndex) == 11) {
    warp = vec2(columnsNoise(st)) * warpSize * 0.5;
  } else if (int(u_WarpShapeIndex) == 12) {
    warp = vec2(flatNoise(st)) * warpSize;
  } else if (int(u_WarpShapeIndex) == 13) {
    float effect = blackHoleNoise(st);
    vec2 toCenter = st - vec2(0.5);
    float len = length(toCenter);
    if (len > 0.0) {
      vec2 dir = toCenter / len;
      warp = dir * effect * warpSize * 1.5;
    }
    else {
      warp = vec2(0.0);
    }
  }
  return warp;
}

vec3 calculateOriginalWarpGradient(vec2 st) {
  float pointGradient = 0.0;
  vec3 colorGradient = vec3(0.0);
  float totalLight = 1.0;
  for(int i = 0; i < MAX_POINTS; i++) {
    if(i < int(u_PointsNum)) {
      vec3 color = u_Points[i].color;
      vec2 pointPos = u_Points[i].position;
      float dist = 1.0 - distance(st, pointPos) * 1.1;
      float clampedDist = clamp(dist, 0.0, 1.0);
      pointGradient += clampedDist;
      colorGradient += color * clampedDist;
      totalLight *= (1.0 - clampedDist) * (1.0 - clampedDist);
    }
  }
  totalLight = smoothstep(0.0, 1.0, clamp(1.0 - totalLight, 0.0, 1.0));
  colorGradient = (colorGradient / pointGradient) * totalLight;
  vec3 bgGradient = (1.0 - totalLight) * u_BgColor;
  return clamp(colorGradient, 0.0, 1.0) + bgGradient;
}

vec3 calculateBezierGradient(vec2 st) {
  vec3 color = vec3(0.0);
  float totalWeight = 0.0;
  float sigma = 0.2; // Standard deviation for Gaussian distribution

  float twoSigmaSquare = 2.0 * sigma * sigma;
  for (int i = 0; i < MAX_POINTS; i++) {
    if (i < int(u_PointsNum)) {
      vec2 pointPos = u_Points[i].position;
      float dist = distance(st, pointPos);

      // Gaussian weight

      float weight = exp(-dist * dist / twoSigmaSquare);
      color += u_Points[i].color * weight;
      totalWeight += weight;
    }
  }
  if (totalWeight > 0.0) {
    color /= totalWeight;
  }
  else {
    color = u_BgColor;
  }
  return color;
}

vec3 calculateMeshGradient(vec2 st) {
  const int GRID_SIZE = 3; // 3x3 grid

  vec2 gridSt = st * float(GRID_SIZE - 1);
  vec2 gridCell = floor(gridSt);
  vec2 gridFract = fract(gridSt);
  vec3 colorBottomLeft = u_BgColor;
  vec3 colorBottomRight = u_BgColor;
  vec3 colorTopLeft = u_BgColor;
  vec3 colorTopRight = u_BgColor;
  int index = int(gridCell.y) * GRID_SIZE + int(gridCell.x);

  int pointsNum = int(u_PointsNum);

  // Bottom Left

  if (index == 0 && 0 < pointsNum) colorBottomLeft = u_Points[0].color;
  if (index == 1 && 1 < pointsNum) colorBottomLeft = u_Points[1].color;
  if (index == 2 && 2 < pointsNum) colorBottomLeft = u_Points[2].color;
  if (index == 3 && 3 < pointsNum) colorBottomLeft = u_Points[3].color;
  if (index == 4 && 4 < pointsNum) colorBottomLeft = u_Points[4].color;
  if (index == 5 && 5 < pointsNum) colorBottomLeft = u_Points[5].color;
  if (index == 6 && 6 < pointsNum) colorBottomLeft = u_Points[6].color;
  if (index == 7 && 7 < pointsNum) colorBottomLeft = u_Points[7].color;
  if (index == 8 && 8 < pointsNum) colorBottomLeft = u_Points[8].color;

  // Bottom Right

  if (index + 1 == 0 && 0 < pointsNum) colorBottomRight = u_Points[0].color;
  if (index + 1 == 1 && 1 < pointsNum) colorBottomRight = u_Points[1].color;
  if (index + 1 == 2 && 2 < pointsNum) colorBottomRight = u_Points[2].color;
  if (index + 1 == 3 && 3 < pointsNum) colorBottomRight = u_Points[3].color;
  if (index + 1 == 4 && 4 < pointsNum) colorBottomRight = u_Points[4].color;
  if (index + 1 == 5 && 5 < pointsNum) colorBottomRight = u_Points[5].color;
  if (index + 1 == 6 && 6 < pointsNum) colorBottomRight = u_Points[6].color;
  if (index + 1 == 7 && 7 < pointsNum) colorBottomRight = u_Points[7].color;
  if (index + 1 == 8 && 8 < pointsNum) colorBottomRight = u_Points[8].color;

  // Top Left

  if (index + GRID_SIZE == 0 && 0 < pointsNum) colorTopLeft = u_Points[0].color;
  if (index + GRID_SIZE == 1 && 1 < pointsNum) colorTopLeft = u_Points[1].color;
  if (index + GRID_SIZE == 2 && 2 < pointsNum) colorTopLeft = u_Points[2].color;
  if (index + GRID_SIZE == 3 && 3 < pointsNum) colorTopLeft = u_Points[3].color;
  if (index + GRID_SIZE == 4 && 4 < pointsNum) colorTopLeft = u_Points[4].color;
  if (index + GRID_SIZE == 5 && 5 < pointsNum) colorTopLeft = u_Points[5].color;
  if (index + GRID_SIZE == 6 && 6 < pointsNum) colorTopLeft = u_Points[6].color;
  if (index + GRID_SIZE == 7 && 7 < pointsNum) colorTopLeft = u_Points[7].color;
  if (index + GRID_SIZE == 8 && 8 < pointsNum) colorTopLeft = u_Points[8].color;

  // Top Right

  if (index + GRID_SIZE + 1 == 0 && 0 < pointsNum) colorTopRight = u_Points[0].color;
  if (index + GRID_SIZE + 1 == 1 && 1 < pointsNum) colorTopRight = u_Points[1].color;
  if (index + GRID_SIZE + 1 == 2 && 2 < pointsNum) colorTopRight = u_Points[2].color;
  if (index + GRID_SIZE + 1 == 3 && 3 < pointsNum) colorTopRight = u_Points[3].color;
  if (index + GRID_SIZE + 1 == 4 && 4 < pointsNum) colorTopRight = u_Points[4].color;
  if (index + GRID_SIZE + 1 == 5 && 5 < pointsNum) colorTopRight = u_Points[5].color;
  if (index + GRID_SIZE + 1 == 6 && 6 < pointsNum) colorTopRight = u_Points[6].color;
  if (index + GRID_SIZE + 1 == 7 && 7 < pointsNum) colorTopRight = u_Points[7].color;
  if (index + GRID_SIZE + 1 == 8 && 8 < pointsNum) colorTopRight = u_Points[8].color;

  // Bilinear interpolation

  vec3 colorBottom = mix(colorBottomLeft, colorBottomRight, gridFract.x);
  vec3 colorTop = mix(colorTopLeft, colorTopRight, gridFract.x);
  return mix(colorBottom, colorTop, gridFract.y);
}

vec3 calculateEnhancedBezier(vec2 st) {
  vec3 color = vec3(0.0);
  float totalWeight = 0.0;

  // Adjustable parameters for gradient behavior

  float baseSigma = 0.25;       // Base spread of each color point

  float weightExponent = 1.8;    // Controls how quickly influence drops off

  float smoothingFactor = 1.2;   // Controls color transition smoothness


  // Calculate weighted contribution from each point
  for (int i = 0; i < MAX_POINTS; i++) {
    if (i < int(u_PointsNum)) {
      vec2 pointPos = u_Points[i].position;
      float dist = distance(st, pointPos);

      // Enhanced weight calculation with smoother falloff

      float weight = exp(-dist * dist / (2.0 * baseSigma * baseSigma));
      weight = pow(weight, weightExponent);

      // Apply smoothing to weight

      weight = smoothstep(0.0, smoothingFactor, weight);
      color += u_Points[i].color * weight;
      totalWeight += weight;
    }
  }
  // Normalize colors with enhanced blending
  if (totalWeight > 0.0) {
      color = color / totalWeight;
      // Subtle enhancement of color vibrancy
      color = mix(color, pow(color, vec3(0.95)), 0.3);
  }
  else {
      color = u_BgColor;
  }
  return color;
}

void main() {
  vec2 st = v_TexCoord;

  vec2 warp = applyWarpShape(st, u_WarpSize, u_Time) * u_WarpRatio;
  vec2 warpedSt = st + warp;

  vec3 gradientColor;
  if (int(u_GradientTypeIndex) == 0) {
    gradientColor = calculateOriginalWarpGradient(warpedSt);
  } else if (int(u_GradientTypeIndex) == 1) {
    gradientColor = calculateBezierGradient(warpedSt);
  } else if (int(u_GradientTypeIndex) == 2) {
    gradientColor = calculateMeshGradient(warpedSt);
  } else if (int(u_GradientTypeIndex) == 3) {
    gradientColor = calculateEnhancedBezier(warpedSt);
  } else {
    gradientColor = u_BgColor; // Default fallback
  }

  // Apply noise
  vec3 noise = vec3(rand(vec2(st.x * 5. + u_NoiseTime, st.y * 5. - u_NoiseTime)));
  vec3 finalColor = mix(gradientColor, noise, u_NoiseRatio);
  outputColor = vec4(finalColor, 1.0);
}
`;
